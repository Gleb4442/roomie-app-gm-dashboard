import jwt from 'jsonwebtoken';
import { prisma } from '../../config/database';
import { redis } from '../../config/redis';
import { env } from '../../config/environment';
import { sendOtpSms } from '../../shared/utils/smsOtp';
import { AppError } from '../../shared/middleware/errorHandler';
import { EntrySource, Prisma } from '@prisma/client';
import { computeSubStage } from '../journey/journey.service';

const OTP_TTL = 300; // 5 minutes
const OTP_PREFIX = 'otp:phone:';

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function normalizePhone(phone: string): string {
  const cleaned = phone.replace(/[\s\-().]/g, '');
  return cleaned.startsWith('+') ? cleaned : `+${cleaned}`;
}

function generateAccessToken(id: string, phone: string): string {
  return jwt.sign({ id, phone }, env.jwtSecret, { expiresIn: '15m' });
}

function generateRefreshToken(id: string, phone: string): string {
  return jwt.sign({ id, phone }, env.jwtRefreshSecret, { expiresIn: '30d' });
}

export const guestService = {
  async register(rawPhone: string, firstName: string) {
    const phone = normalizePhone(rawPhone);
    const otp = generateOTP();

    await redis.setex(`${OTP_PREFIX}${phone}`, OTP_TTL, otp);
    await redis.setex(`pending:phone:${phone}`, OTP_TTL, JSON.stringify({ firstName }));
    await sendOtpSms(phone, otp);

    return { message: 'OTP sent to your phone' };
  },

  async verifyOtp(rawPhone: string, code: string) {
    const phone = normalizePhone(rawPhone);
    const storedOtp = await redis.get(`${OTP_PREFIX}${phone}`);

    if (!storedOtp) throw new AppError(400, 'OTP expired or not found');
    if (storedOtp !== code) throw new AppError(400, 'Invalid OTP');

    await redis.del(`${OTP_PREFIX}${phone}`);

    let guest = await prisma.guestAccount.findUnique({ where: { phone } });

    if (!guest) {
      const pendingRaw = await redis.get(`pending:phone:${phone}`);
      const { firstName } = pendingRaw ? JSON.parse(pendingRaw) : { firstName: 'Guest' };
      guest = await prisma.guestAccount.create({
        data: { phone, firstName, phoneVerified: true },
      });
      await redis.del(`pending:phone:${phone}`);
    } else if (!guest.phoneVerified) {
      guest = await prisma.guestAccount.update({
        where: { id: guest.id },
        data: { phoneVerified: true },
      });
    }

    const accessToken = generateAccessToken(guest.id, guest.phone!);
    const refreshToken = generateRefreshToken(guest.id, guest.phone!);

    return {
      accessToken,
      refreshToken,
      guest: { id: guest.id, phone: guest.phone, firstName: guest.firstName, lastName: guest.lastName },
    };
  },

  async login(rawPhone: string) {
    const phone = normalizePhone(rawPhone);
    const guest = await prisma.guestAccount.findUnique({ where: { phone } });

    if (!guest) throw new AppError(404, 'Account not found. Please register first.');

    const otp = generateOTP();
    await redis.setex(`${OTP_PREFIX}${phone}`, OTP_TTL, otp);
    await sendOtpSms(phone, otp);

    return { message: 'OTP sent to your phone' };
  },

  async refreshToken(token: string) {
    try {
      const payload = jwt.verify(token, env.jwtRefreshSecret) as { id: string; phone: string };
      const guest = await prisma.guestAccount.findUnique({ where: { id: payload.id } });
      if (!guest) throw new AppError(401, 'Guest not found');
      const accessToken = generateAccessToken(guest.id, guest.phone!);
      return { accessToken };
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw new AppError(401, 'Invalid refresh token');
    }
  },

  async getMe(guestId: string) {
    const guest = await prisma.guestAccount.findUnique({
      where: { id: guestId },
      select: {
        id: true, email: true, phone: true, firstName: true, lastName: true,
        phoneVerified: true, emailVerified: true, createdVia: true,
        roomieChatId: true, profile: true, preferences: true, createdAt: true,
        hotelLinks: { include: { hotel: true }, orderBy: { linkedAt: 'desc' } },
        stays: { include: { hotel: true }, orderBy: { createdAt: 'desc' }, take: 10 },
      },
    });

    if (!guest) throw new AppError(404, 'Guest not found');
    return guest;
  },

  async linkHotel(guestId: string, data: {
    hotelId: string;
    source?: EntrySource;
    roomNumber?: string;
    contextParams?: Record<string, unknown>;
  }) {
    const hotel = await prisma.hotel.findUnique({ where: { id: data.hotelId } });
    if (!hotel) throw new AppError(404, 'Hotel not found');

    return prisma.guestHotel.upsert({
      where: { guestId_hotelId: { guestId, hotelId: data.hotelId } },
      update: {
        source: data.source || 'organic',
        roomNumber: data.roomNumber || undefined,
        contextParams: (data.contextParams as Prisma.InputJsonValue) ?? undefined,
      },
      create: {
        guestId, hotelId: data.hotelId,
        source: data.source || 'organic',
        roomNumber: data.roomNumber,
        contextParams: (data.contextParams as Prisma.InputJsonValue) ?? undefined,
      },
      include: { hotel: true },
    });
  },

  async linkBooking(guestId: string, hotelId: string, bookingRef: string) {
    const hotel = await prisma.hotel.findUnique({ where: { id: hotelId } });
    if (!hotel) throw new AppError(404, 'Hotel not found');

    const existing = await prisma.guestStay.findFirst({ where: { bookingRef, hotelId } });
    if (existing) {
      if (existing.guestId !== guestId) throw new AppError(409, 'Booking already linked to another guest');
      return existing;
    }

    const subStage = computeSubStage('PRE_ARRIVAL', null, null);
    const stay = await prisma.guestStay.create({
      data: { guestId, hotelId, bookingRef, stage: 'PRE_ARRIVAL', subStage, enteredVia: 'sms_booking' },
      include: { hotel: true },
    });

    await prisma.guestHotel.upsert({
      where: { guestId_hotelId: { guestId, hotelId } },
      update: {},
      create: { guestId, hotelId, source: 'sms_booking' },
    });

    return stay;
  },

  async linkChat(guestId: string, roomieChatId: string) {
    await prisma.guestAccount.update({ where: { id: guestId }, data: { roomieChatId } });
    return { linked: true };
  },

  async findByEmail(email: string) {
    const guest = await prisma.guestAccount.findUnique({
      where: { email },
      select: {
        id: true, roomieChatId: true,
        stays: {
          where: { stage: { in: ['PRE_ARRIVAL', 'CHECKED_IN', 'IN_STAY'] } },
          orderBy: { updatedAt: 'desc' }, take: 1,
          select: { id: true, stage: true, hotelId: true, checkIn: true, checkOut: true },
        },
      },
    });

    if (!guest) throw new AppError(404, 'Guest not found');
    return { guestId: guest.id, roomieChatId: guest.roomieChatId, activeStay: guest.stays[0] || null };
  },

  async quickRegister(rawPhone: string, firstName: string) {
    const phone = normalizePhone(rawPhone);
    let guest = await prisma.guestAccount.findUnique({ where: { phone } });

    if (!guest) {
      guest = await prisma.guestAccount.create({
        data: { phone, firstName, createdVia: 'qr_room', phoneVerified: true },
      });
    }

    const accessToken = generateAccessToken(guest.id, guest.phone!);
    const refreshToken = generateRefreshToken(guest.id, guest.phone!);

    return {
      accessToken, refreshToken,
      guest: { id: guest.id, phone: guest.phone, firstName: guest.firstName, lastName: guest.lastName },
    };
  },

  async deleteAccount(guestId: string) {
    const guest = await prisma.guestAccount.findUnique({ where: { id: guestId } });
    if (!guest) throw new AppError(404, 'Guest not found');

    // Get stay IDs to delete late checkout requests (linked via stayId, not guestId)
    const stays = await prisma.guestStay.findMany({ where: { guestId }, select: { id: true } });
    const stayIds = stays.map(s => s.id);

    // Get dependent IDs for cascading deletes
    const orders = await prisma.order.findMany({ where: { guestId }, select: { id: true } });
    const orderIds = orders.map(o => o.id);
    const loyaltyAccounts = await prisma.loyaltyAccount.findMany({ where: { guestId }, select: { id: true } });
    const loyaltyAccountIds = loyaltyAccounts.map(a => a.id);

    await prisma.$transaction([
      // Loyalty
      ...(loyaltyAccountIds.length > 0 ? [prisma.loyaltyTransaction.deleteMany({ where: { accountId: { in: loyaltyAccountIds } } })] : []),
      prisma.loyaltyAccount.deleteMany({ where: { guestId } }),
      // Late checkout requests (via stayId)
      ...(stayIds.length > 0 ? [prisma.lateCheckoutRequest.deleteMany({ where: { stayId: { in: stayIds } } })] : []),
      // Service requests (items cascade automatically)
      prisma.serviceRequest.deleteMany({ where: { guestId } }),
      // Order items then orders
      ...(orderIds.length > 0 ? [prisma.orderItem.deleteMany({ where: { orderId: { in: orderIds } } })] : []),
      prisma.order.deleteMany({ where: { guestId } }),
      // Nullify optional references
      prisma.appOpen.deleteMany({ where: { guestId } }),
      prisma.sMSLog.updateMany({ where: { guestId }, data: { guestId: null } }),
      prisma.qRScan.updateMany({ where: { guestId }, data: { guestId: null } }),
      // Core guest data
      prisma.guestStay.deleteMany({ where: { guestId } }),
      prisma.guestHotel.deleteMany({ where: { guestId } }),
      prisma.guestAccount.delete({ where: { id: guestId } }),
    ]);

    return { deleted: true };
  },
};

// Note: This extends guestService after module definition via an export
export async function updateGuestProfile(guestId: string, data: { firstName?: string; lastName?: string; phone?: string }) {
  const updated = await prisma.guestAccount.update({
    where: { id: guestId },
    data: {
      ...(data.firstName ? { firstName: data.firstName } : {}),
      ...(data.lastName !== undefined ? { lastName: data.lastName } : {}),
      ...(data.phone ? { phone: data.phone } : {}),
    },
    select: { id: true, email: true, phone: true, firstName: true, lastName: true, roomieChatId: true },
  });
  return updated;
}
