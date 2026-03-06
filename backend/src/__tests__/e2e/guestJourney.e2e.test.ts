/**
 * E2E Test — Full Guest Journey
 *
 * Tests the complete guest experience from PMS booking webhook through checkout.
 * Uses MockPMSAdapter (no real PMS) and LogAdapter (no real SMS sending).
 *
 * Flow:
 *   1. PMS webhook → GuestStay(PRE_ARRIVAL)
 *   2. Guest registers via SMS deep link → link booking
 *   3. Pre-check-in native form
 *   4. PMS check-in webhook → GuestStay(IN_STAY) + Room OCCUPIED
 *   5. Food order + service requests
 *   6. Late checkout request + room extension
 *   7. PMS checkout webhook → GuestStay(POST_STAY) + Room DIRTY
 */

import request from 'supertest';
import { v4 as uuid } from 'uuid';
import app from '../../app';
import { prisma } from '../../config/database';
import { redis } from '../../config/redis';

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Poll a DB query until it returns a truthy result or timeout. */
async function waitFor<T>(
  fn: () => Promise<T | null | undefined>,
  timeoutMs = 8000,
  intervalMs = 300,
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const result = await fn();
    if (result) return result;
    await new Promise(r => setTimeout(r, intervalMs));
  }
  throw new Error(`waitFor timed out after ${timeoutMs}ms`);
}

/** Normalize phone the same way guest.service.ts does. */
function normalizePhone(phone: string): string {
  const cleaned = phone.replace(/[\s\-().]/g, '');
  return cleaned.startsWith('+') ? cleaned : `+${cleaned}`;
}

// ── Test State ────────────────────────────────────────────────────────────────

const TEST_HOTEL_SLUG = `e2e-test-${uuid().slice(0, 8)}`;
const TEST_PHONE = '+380991234599';
const NORM_PHONE = normalizePhone(TEST_PHONE);
const BOOKING_EXT_ID = `MOCK-${uuid()}`;
const CHECK_IN_DATE = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000); // +2 days
const CHECK_OUT_DATE = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000); // +5 days

let testHotelId: string;
let testServiceCategoryId: string;
let testServiceItemId: string;
let testHotelServiceId: string;
let guestAccessToken: string;
let currentStayId: string;

// ── Setup & Teardown ──────────────────────────────────────────────────────────

beforeAll(async () => {
  // 1. Create test hotel
  const hotel = await prisma.hotel.create({
    data: {
      name: `E2E Test Hotel ${TEST_HOTEL_SLUG}`,
      slug: TEST_HOTEL_SLUG,
      location: 'Test City',
      timezone: 'Europe/Kiev',
    },
  });
  testHotelId = hotel.id;

  // 2. PMS config — mock adapter, with our test reservation pre-loaded
  await prisma.hotelPMSConfig.create({
    data: {
      hotelId: testHotelId,
      pmsType: 'mock',
      syncMode: 'WEBHOOK',
      isActive: true,
      syncEnabled: true,
      credentials: {
        scenario: 'standard',
        reservations: [
          {
            externalId: BOOKING_EXT_ID,
            guestName: 'Test Guest',
            guestPhone: TEST_PHONE,
            guestEmail: `e2e-${uuid().slice(0, 8)}@test.local`,
            roomNumber: '305',
            roomType: 'Standard',
            checkIn: CHECK_IN_DATE.toISOString(),
            checkOut: CHECK_OUT_DATE.toISOString(),
            status: 'confirmed',
            adults: 2,
            children: 0,
            source: 'OTA',
            totalAmount: 500,
            currency: 'UAH',
          },
        ],
      } as any,
    },
  });

  // 3. SMS config — log adapter (logs instead of sending)
  await prisma.hotelSMSConfig.create({
    data: {
      hotelId: testHotelId,
      provider: 'log',
      senderName: 'E2E Test',
      enabled: true,
      credentials: {} as any,
    },
  });

  // 4. Create test room
  await prisma.room.create({
    data: {
      hotelId: testHotelId,
      roomNumber: '305',
      floor: 3,
      roomType: 'Standard',
      maxOccupancy: 2,
      housekeepingStatus: 'READY',
      occupancyStatus: 'VACANT',
    },
  });

  // 5. Create a staff member (needed for InternalTask.createdById)
  const staff = await prisma.staffMember.create({
    data: {
      hotelId: testHotelId,
      email: `gm-${uuid().slice(0, 8)}@e2etest.local`,
      firstName: 'Test',
      lastName: 'Manager',
      role: 'GENERAL_MANAGER',
      department: 'MANAGEMENT',
      passwordHash: '$2b$10$e2etesthash0000000000uXXXXXXXXXXXXXXXXXXXXXX',
      isActive: true,
    },
  });

  // Start a shift for this staff member (needed for auto-assign)
  await prisma.staffShift.create({
    data: {
      staffId: staff.id,
      hotelId: testHotelId,
      isActive: true,
    },
  });

  // 6. Create service category + item (for service requests)
  const category = await prisma.serviceCategory.create({
    data: {
      hotelId: testHotelId,
      slug: 'housekeeping-e2e',
      name: 'Housekeeping',
      nameEn: 'Housekeeping',
      nameUk: 'Господарча служба',
      isActive: true,
    },
  });
  testServiceCategoryId = category.id;

  const item = await prisma.serviceItem.create({
    data: {
      categoryId: testServiceCategoryId,
      name: 'Extra Towels',
      nameEn: 'Extra Towels',
      nameUk: 'Додаткові рушники',
      price: 0,
      isActive: true,
    },
  });
  testServiceItemId = item.id;

  // 7. Create a HotelService for food orders
  const hotelService = await prisma.hotelService.create({
    data: {
      hotelId: testHotelId,
      category: 'FOOD',
      name: 'Caesar Salad',
      description: 'Fresh caesar salad',
      price: 120,
      currency: 'UAH',
    },
  });
  testHotelServiceId = hotelService.id;
});

afterAll(async () => {
  if (!testHotelId) return;

  // Collect stay IDs for cleanup of related records
  const stays = await prisma.guestStay.findMany({
    where: { hotelId: testHotelId },
    select: { id: true },
  });
  const stayIds = stays.map(s => s.id);

  // Clean up in reverse FK order
  if (stayIds.length > 0) {
    await prisma.lateCheckoutRequest.deleteMany({ where: { stayId: { in: stayIds } } });
    await prisma.stageTransition.deleteMany({ where: { guestStayId: { in: stayIds } } });
  }

  await prisma.serviceRequestItem.deleteMany({ where: { serviceRequest: { hotelId: testHotelId } } });
  await prisma.serviceRequest.deleteMany({ where: { hotelId: testHotelId } });
  await prisma.orderItem.deleteMany({ where: { order: { hotelId: testHotelId } } });
  await prisma.order.deleteMany({ where: { hotelId: testHotelId } });
  await prisma.guestStay.deleteMany({ where: { hotelId: testHotelId } });
  await prisma.guestHotel.deleteMany({ where: { hotelId: testHotelId } });
  await prisma.sMSLog.deleteMany({ where: { hotelId: testHotelId } });
  await prisma.internalTask.deleteMany({ where: { hotelId: testHotelId } });
  await prisma.roomStatusChange.deleteMany({ where: { room: { hotelId: testHotelId } } });
  await prisma.room.deleteMany({ where: { hotelId: testHotelId } });
  await prisma.staffShift.deleteMany({ where: { hotelId: testHotelId } });
  await prisma.staffMember.deleteMany({ where: { hotelId: testHotelId } });
  // ServiceItem has no hotelId — delete via category
  await prisma.serviceItem.deleteMany({ where: { categoryId: testServiceCategoryId } });
  await prisma.serviceCategory.deleteMany({ where: { hotelId: testHotelId } });
  await prisma.hotelService.deleteMany({ where: { hotelId: testHotelId } });
  await prisma.hotelSMSConfig.deleteMany({ where: { hotelId: testHotelId } });
  await prisma.hotelPMSConfig.deleteMany({ where: { hotelId: testHotelId } });

  // Remove guest accounts created during test (by phone)
  await prisma.guestAccount.deleteMany({ where: { phone: NORM_PHONE } });
  // Remove placeholder guest created by PMS sync
  await prisma.guestAccount.deleteMany({ where: { email: { contains: '@test.local' } } });

  await prisma.hotel.delete({ where: { id: testHotelId } });

  // Clean up Redis OTP keys
  await redis.del(`otp:phone:${NORM_PHONE}`);
  await redis.del(`pending:phone:${NORM_PHONE}`);
});

// ── Phase 1: Booking via PMS Webhook ─────────────────────────────────────────

describe('Phase 1: Booking via PMS webhook → GuestStay(PRE_ARRIVAL)', () => {
  test('POST /api/webhooks/pms/:hotelId with reservation_created → 200', async () => {
    const res = await request(app)
      .post(`/api/webhooks/pms/${testHotelId}`)
      .send({
        type: 'reservation_created',
        externalId: BOOKING_EXT_ID,
      })
      .expect(200);

    expect(res.body.received).toBe(true);
  });

  test('GuestStay with PRE_ARRIVAL is created by PMS sync (async)', async () => {
    const stay = await waitFor(() =>
      prisma.guestStay.findUnique({
        where: { externalReservationId: BOOKING_EXT_ID },
      }),
    );

    expect(stay).toBeTruthy();
    expect(stay.stage).toBe('PRE_ARRIVAL');
    expect(stay.hotelId).toBe(testHotelId);
    expect(stay.roomNumber).toBe('305');

    currentStayId = stay.id;
  });
});

// ── Phase 2: Guest Registration via SMS Deep Link ─────────────────────────────

describe('Phase 2: Guest registration → link booking', () => {
  test('POST /api/guest/register sends OTP (logged, not sent)', async () => {
    const res = await request(app)
      .post('/api/guest/register')
      .send({ phone: TEST_PHONE, firstName: 'Dmytro' })
      .expect(200);

    expect(res.body.success).toBe(true);
  });

  test('POST /api/guest/verify-otp with code from Redis → accessToken', async () => {
    // OTP was stored in Redis by register — read it directly
    const otp = await redis.get(`otp:phone:${NORM_PHONE}`);
    expect(otp).toBeTruthy();

    const res = await request(app)
      .post('/api/guest/verify-otp')
      .send({ phone: TEST_PHONE, code: otp })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeTruthy();

    guestAccessToken = res.body.data.accessToken;
  });

  test('POST /api/guest/link-booking → stay linked to guest account', async () => {
    const res = await request(app)
      .post('/api/guest/link-booking')
      .set('Authorization', `Bearer ${guestAccessToken}`)
      .send({ hotelId: testHotelId, bookingRef: BOOKING_EXT_ID })
      .expect(200);

    expect(res.body.success).toBe(true);

    // Verify stay is now linked to the authenticated guest
    const stay = await prisma.guestStay.findUnique({
      where: { externalReservationId: BOOKING_EXT_ID },
      include: { guest: true },
    });
    expect(stay?.guest.phone).toBe(NORM_PHONE);
  });

  test('GET /api/guest/current-stay → PRE_ARRIVAL with hotel & dates', async () => {
    const res = await request(app)
      .get('/api/guest/current-stay')
      .set('Authorization', `Bearer ${guestAccessToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    // Response shape: { stage, stay: {...}, hotel: {...} }
    const data = res.body.data;
    expect(data.stage).toBe('PRE_ARRIVAL');
    expect(data.hotel).toBeTruthy();
    expect(data.stay).toBeTruthy();
    expect(data.stay.checkIn).toBeTruthy();
    expect(data.stay.checkOut).toBeTruthy();
  });
});

// ── Phase 3: Pre-Check-In ─────────────────────────────────────────────────────

describe('Phase 3: Native pre-check-in form', () => {
  test('POST /api/precheckin/native-submit → preCheckinCompleted = true', async () => {
    const res = await request(app)
      .post('/api/precheckin/native-submit')
      .set('Authorization', `Bearer ${guestAccessToken}`)
      .send({
        stayId: currentStayId,
        personalData: {
          firstName: 'Dmytro',
          lastName: 'Kovalenko',
          phone: TEST_PHONE,
          birthDate: '1990-05-15',
          nationality: 'UA',
        },
        document: {
          type: 'passport',
          number: 'AB123456',
        },
        preferences: {
          bedType: 'king',
          pillow: 'soft',
          floor: 'high',
          specialRequests: 'Late arrival, approximately 22:00',
        },
      })
      .expect(200);

    expect(res.body.success).toBe(true);

    const stay = await prisma.guestStay.findUnique({ where: { id: currentStayId } });
    expect(stay?.preCheckinCompleted).toBe(true);
  });
});

// ── Phase 4: Check-In Webhook ─────────────────────────────────────────────────

describe('Phase 4: PMS check-in webhook → IN_STAY + room OCCUPIED', () => {
  test('POST /api/webhooks/pms/:hotelId with guest_checked_in → 200', async () => {
    // Update mock credentials: change reservation status to checked_in
    const config = await prisma.hotelPMSConfig.findUnique({ where: { hotelId: testHotelId } });
    const creds = config!.credentials as Record<string, unknown>;
    const reservations = (creds.reservations as Array<Record<string, unknown>>).map(r => ({
      ...r,
      status: 'checked_in',
    }));

    await prisma.hotelPMSConfig.update({
      where: { hotelId: testHotelId },
      data: { credentials: { ...creds, reservations } as any },
    });

    const res = await request(app)
      .post(`/api/webhooks/pms/${testHotelId}`)
      .send({
        type: 'guest_checked_in',
        externalId: BOOKING_EXT_ID,
      })
      .expect(200);

    expect(res.body.received).toBe(true);
  });

  test('GuestStay transitions to IN_STAY (async)', async () => {
    const stay = await waitFor(async () => {
      const s = await prisma.guestStay.findUnique({ where: { id: currentStayId } });
      return s?.stage === 'IN_STAY' ? s : null;
    });

    expect(stay.stage).toBe('IN_STAY');
    expect(stay.roomNumber).toBe('305');
  });

  test('Room 305 occupancy becomes OCCUPIED', async () => {
    const room = await waitFor(async () => {
      const r = await prisma.room.findUnique({
        where: { hotelId_roomNumber: { hotelId: testHotelId, roomNumber: '305' } },
      });
      return r?.occupancyStatus === 'OCCUPIED' ? r : null;
    });

    expect(room.occupancyStatus).toBe('OCCUPIED');
  });
});

// ── Phase 5: In-Stay Services ─────────────────────────────────────────────────

describe('Phase 5: In-stay — food order + service requests', () => {
  let orderId: string;

  test('POST /api/orders — food order created (PENDING)', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${guestAccessToken}`)
      .send({
        hotelId: testHotelId,
        type: 'FOOD',
        items: [{ serviceId: testHotelServiceId, quantity: 1 }],
        roomNumber: '305',
        specialInstructions: 'No croutons please',
      })
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('PENDING');
    orderId = res.body.data.id;
  });

  test('GET /api/orders/:id — order is retrievable', async () => {
    const res = await request(app)
      .get(`/api/orders/${orderId}`)
      .set('Authorization', `Bearer ${guestAccessToken}`)
      .expect(200);

    expect(res.body.data.id).toBe(orderId);
    expect(res.body.data.roomNumber).toBe('305');
  });

  test('POST /:hotelId/services/requests — extra towels (service request)', async () => {
    const res = await request(app)
      .post(`/api/hotels/${testHotelId}/services/requests`)
      .set('Authorization', `Bearer ${guestAccessToken}`)
      .send({
        categoryId: testServiceCategoryId,
        items: [{ serviceItemId: testServiceItemId, quantity: 4 }],
        roomNumber: '305',
        comment: 'Please bring 4 extra towels',
        guestStayId: currentStayId,
      })
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('pending');
  });

  test('GET /my requests — guest can see their requests', async () => {
    const res = await request(app)
      .get(`/api/hotels/${testHotelId}/services/requests/my`)
      .set('Authorization', `Bearer ${guestAccessToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
  });
});

// ── Phase 6: Late Checkout & Room Extension ────────────────────────────────────

describe('Phase 6: Late checkout request + room extension', () => {
  test('POST /api/stays/:stayId/late-checkout → PENDING request + URGENT FO task', async () => {
    const res = await request(app)
      .post(`/api/stays/${currentStayId}/late-checkout`)
      .set('Authorization', `Bearer ${guestAccessToken}`)
      .send({ requestedTime: '13:00', notes: 'Flight departs at 15:30' })
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('PENDING');
    expect(res.body.data.requestedTime).toBe('13:00');

    // Verify InternalTask was created for FRONT_OFFICE
    const task = await prisma.internalTask.findFirst({
      where: {
        hotelId: testHotelId,
        department: 'FRONT_OFFICE',
        priority: 'URGENT',
        title: { contains: 'Late Checkout' },
      },
    });
    expect(task).toBeTruthy();
  });

  test('GET /api/stays/:stayId/late-checkout → returns PENDING status', async () => {
    const res = await request(app)
      .get(`/api/stays/${currentStayId}/late-checkout`)
      .set('Authorization', `Bearer ${guestAccessToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('PENDING');
  });

  test('POST /api/stays/:stayId/extend with available room → extensionStatus PENDING', async () => {
    const newCheckOut = new Date(CHECK_OUT_DATE.getTime() + 24 * 60 * 60 * 1000);

    const res = await request(app)
      .post(`/api/stays/${currentStayId}/extend`)
      .set('Authorization', `Bearer ${guestAccessToken}`)
      .send({ newCheckOut: newCheckOut.toISOString() })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.extensionStatus).toBe('PENDING');
  });

  test('POST /api/stays/:stayId/extend with unavailable room → 409', async () => {
    // Switch mock PMS to room_unavailable scenario
    const config = await prisma.hotelPMSConfig.findUnique({ where: { hotelId: testHotelId } });
    const creds = config!.credentials as Record<string, unknown>;

    await prisma.hotelPMSConfig.update({
      where: { hotelId: testHotelId },
      data: { credentials: { ...creds, scenario: 'room_unavailable' } as any },
    });

    const newCheckOut = new Date(CHECK_OUT_DATE.getTime() + 2 * 24 * 60 * 60 * 1000);

    const res = await request(app)
      .post(`/api/stays/${currentStayId}/extend`)
      .set('Authorization', `Bearer ${guestAccessToken}`)
      .send({ newCheckOut: newCheckOut.toISOString() })
      .expect(409);

    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/not available/i);

    // Reset scenario back to standard for checkout phase
    await prisma.hotelPMSConfig.update({
      where: { hotelId: testHotelId },
      data: { credentials: { ...creds, scenario: 'standard' } as any },
    });
  });
});

// ── Phase 7: Checkout via PMS Webhook ─────────────────────────────────────────

describe('Phase 7: PMS checkout webhook → POST_STAY + room DIRTY', () => {
  test('POST /api/webhooks/pms/:hotelId with guest_checked_out → 200', async () => {
    // Update mock credentials: change reservation status to checked_out
    const config = await prisma.hotelPMSConfig.findUnique({ where: { hotelId: testHotelId } });
    const creds = config!.credentials as Record<string, unknown>;
    const reservations = (creds.reservations as Array<Record<string, unknown>>).map(r => ({
      ...r,
      status: 'checked_out',
    }));

    await prisma.hotelPMSConfig.update({
      where: { hotelId: testHotelId },
      data: { credentials: { ...creds, reservations } as any },
    });

    const res = await request(app)
      .post(`/api/webhooks/pms/${testHotelId}`)
      .send({
        type: 'guest_checked_out',
        externalId: BOOKING_EXT_ID,
      })
      .expect(200);

    expect(res.body.received).toBe(true);
  });

  test('GuestStay transitions to POST_STAY (async)', async () => {
    const stay = await waitFor(async () => {
      const s = await prisma.guestStay.findUnique({ where: { id: currentStayId } });
      return s?.stage === 'POST_STAY' ? s : null;
    });

    expect(stay.stage).toBe('POST_STAY');
  });

  test('Room 305 housekeeping status becomes DIRTY (auto-triggered on checkout)', async () => {
    const room = await waitFor(async () => {
      const r = await prisma.room.findUnique({
        where: { hotelId_roomNumber: { hotelId: testHotelId, roomNumber: '305' } },
      });
      return r?.housekeepingStatus === 'DIRTY' ? r : null;
    });

    expect(room.housekeepingStatus).toBe('DIRTY');
  });

  test('Cleaning InternalTask was auto-created for DIRTY room', async () => {
    const task = await prisma.internalTask.findFirst({
      where: {
        hotelId: testHotelId,
        department: 'HOUSEKEEPING',
        roomNumber: '305',
        title: { contains: 'Cleaning' },
      },
    });

    expect(task).toBeTruthy();
    expect(['NEW', 'ASSIGNED']).toContain(task!.status);
  });
});
