import { prisma } from '../../config/database';
import { JourneyStage, JourneySubStage } from '@prisma/client';
import { AppError } from '../../shared/middleware/errorHandler';
import { loyaltyService } from '../loyalty/loyalty.service';
import { logger } from '../../shared/utils/logger';

/**
 * Maps a JourneyStage + date context to the correct JourneySubStage.
 * Used both when manually updating stage and by the cron job.
 */
export function computeSubStage(
  stage: JourneyStage,
  checkIn: Date | null,
  checkOut: Date | null,
  now: Date = new Date(),
): JourneySubStage {
  const msInDay = 86_400_000;

  if (stage === 'PRE_ARRIVAL') {
    if (!checkIn) return 'BOOKING_CONFIRMED';
    const daysUntilCheckIn = Math.ceil((checkIn.getTime() - now.getTime()) / msInDay);
    if (daysUntilCheckIn <= 1) return 'DAYS_1_BEFORE';
    if (daysUntilCheckIn <= 7) return 'DAYS_7_BEFORE';
    return 'BOOKING_CONFIRMED';
  }

  if (stage === 'CHECKED_IN') {
    return 'CHECK_IN_DAY';
  }

  if (stage === 'IN_STAY') {
    if (!checkIn || !checkOut) return 'DAY_1';
    const daysInHotel = Math.ceil((now.getTime() - checkIn.getTime()) / msInDay);
    const daysUntilCheckOut = Math.ceil((checkOut.getTime() - now.getTime()) / msInDay);
    if (daysUntilCheckOut <= 1) return 'DAYS_1_BEFORE_OUT';
    const totalNights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / msInDay);
    if (daysInHotel >= Math.floor(totalNights / 2) && totalNights >= 3) return 'MID_STAY';
    if (daysInHotel <= 1) return 'DAY_1';
    return 'MID_STAY';
  }

  if (stage === 'CHECKOUT') {
    return 'CHECKOUT_DAY';
  }

  if (stage === 'POST_STAY') {
    if (!checkOut) return 'DAYS_1_AFTER';
    const daysSinceCheckOut = Math.ceil((now.getTime() - checkOut.getTime()) / msInDay);
    if (daysSinceCheckOut >= 7) return 'DAYS_7_AFTER';
    return 'DAYS_1_AFTER';
  }

  return 'IDLE'; // BETWEEN_STAYS
}

export const journeyService = {
  async getCurrentStay(guestId: string, hotelId?: string) {
    const where: Record<string, unknown> = { guestId };
    if (hotelId) where.hotelId = hotelId;

    // 1. Active stay (IN_STAY or CHECKED_IN)
    const activeStay = await prisma.guestStay.findFirst({
      where: { ...where, stage: { in: ['IN_STAY', 'CHECKED_IN'] } },
      include: { hotel: true },
      orderBy: { updatedAt: 'desc' },
    });
    if (activeStay) {
      return { stage: activeStay.stage, subStage: activeStay.subStage, stay: activeStay, hotel: activeStay.hotel };
    }

    // 2. Upcoming stay (PRE_ARRIVAL with future checkIn)
    const upcomingStay = await prisma.guestStay.findFirst({
      where: {
        ...where,
        stage: 'PRE_ARRIVAL',
        OR: [
          { checkIn: { gte: new Date() } },
          { checkIn: null },
        ],
      },
      include: { hotel: true },
      orderBy: { checkIn: 'asc' },
    });
    if (upcomingStay) {
      return { stage: 'PRE_ARRIVAL' as JourneyStage, subStage: upcomingStay.subStage, stay: upcomingStay, hotel: upcomingStay.hotel };
    }

    // 3. Recent POST_STAY (within 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentStay = await prisma.guestStay.findFirst({
      where: {
        ...where,
        stage: 'POST_STAY',
        checkOut: { gte: sevenDaysAgo },
      },
      include: { hotel: true },
      orderBy: { checkOut: 'desc' },
    });
    if (recentStay) {
      return { stage: 'POST_STAY' as JourneyStage, subStage: recentStay.subStage, stay: recentStay, hotel: recentStay.hotel };
    }

    // 4. If hotelId specified, try to get hotel info
    if (hotelId) {
      const hotel = await prisma.hotel.findUnique({ where: { id: hotelId } });
      return { stage: 'BETWEEN_STAYS' as JourneyStage, subStage: 'IDLE' as JourneySubStage, stay: null, hotel };
    }

    // 5. Check if guest has any linked hotel
    const lastLink = await prisma.guestHotel.findFirst({
      where: { guestId },
      include: { hotel: true },
      orderBy: { linkedAt: 'desc' },
    });

    return {
      stage: 'BETWEEN_STAYS' as JourneyStage,
      subStage: 'IDLE' as JourneySubStage,
      stay: null,
      hotel: lastLink?.hotel || null,
    };
  },

  async updateStage(stayId: string, guestId: string, stage: JourneyStage, roomNumber?: string) {
    const stay = await prisma.guestStay.findFirst({
      where: { id: stayId, guestId },
    });

    if (!stay) {
      throw new AppError(404, 'Stay not found');
    }

    const subStage = computeSubStage(stage, stay.checkIn, stay.checkOut);

    const updated = await prisma.$transaction(async (tx) => {
      // Log the transition
      await tx.stageTransition.create({
        data: {
          guestStayId: stayId,
          fromStage: stay.stage,
          toStage: stage,
          reason: 'manual',
          metadata: { fromSubStage: stay.subStage, toSubStage: subStage },
        },
      });

      return tx.guestStay.update({
        where: { id: stayId },
        data: {
          stage,
          subStage,
          ...(roomNumber ? { roomNumber } : {}),
        },
        include: { hotel: true },
      });
    });

    // Record loyalty nights on checkout
    if (stage === 'POST_STAY' && stay.checkIn && stay.checkOut) {
      const nights = Math.max(
        1,
        Math.ceil((stay.checkOut.getTime() - stay.checkIn.getTime()) / 86400_000),
      );
      loyaltyService
        .recordNights(guestId, stay.hotelId, nights, stayId)
        .catch((err) => logger.warn({ err, stayId }, '[Loyalty] recordNights failed'));
    }

    return updated;
  },

  /**
   * Recompute and update subStage for all active stays.
   * Called by the cron job every hour.
   */
  async refreshAllSubStages(): Promise<number> {
    const now = new Date();
    let updatedCount = 0;

    // Find all stays that are not BETWEEN_STAYS (active lifecycle)
    const activeStays = await prisma.guestStay.findMany({
      where: {
        stage: { not: 'BETWEEN_STAYS' },
      },
      select: {
        id: true,
        stage: true,
        subStage: true,
        checkIn: true,
        checkOut: true,
        guestId: true,
        hotelId: true,
      },
    });

    for (const stay of activeStays) {
      const newSubStage = computeSubStage(stay.stage, stay.checkIn, stay.checkOut, now);

      if (newSubStage !== stay.subStage) {
        await prisma.$transaction(async (tx) => {
          await tx.stageTransition.create({
            data: {
              guestStayId: stay.id,
              fromStage: stay.stage,
              toStage: stay.stage,
              reason: 'sub_stage_auto_transition',
              metadata: { fromSubStage: stay.subStage, toSubStage: newSubStage },
            },
          });

          await tx.guestStay.update({
            where: { id: stay.id },
            data: { subStage: newSubStage },
          });
        });

        updatedCount++;
        logger.info(
          { stayId: stay.id, from: stay.subStage, to: newSubStage },
          '[Journey] Sub-stage auto-transitioned',
        );
      }
    }

    return updatedCount;
  },
};
