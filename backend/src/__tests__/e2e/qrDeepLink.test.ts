import request from 'supertest';
import bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';
import app from '../../app';
import { prisma } from '../../config/database';

describe('QR deep link format', () => {
  let token: string;
  let hotelId: string;
  let qrId: string;
  let managerId: string;

  beforeAll(async () => {
    const hotel = await prisma.hotel.findFirst();
    if (!hotel) throw new Error('No hotel in DB');
    hotelId = hotel.id;

    // Create a test manager with a known password
    const passwordHash = await bcrypt.hash('testpass123', 10);
    const mgr = await prisma.dashboardManager.create({
      data: { username: `qr-test-mgr-${uuid().slice(0, 8)}`, passwordHash, role: 'manager' },
    });
    managerId = mgr.id;
    await prisma.dashboardManagerHotel.create({ data: { managerId, hotelId } });

    const loginRes = await request(app).post('/api/dashboard/auth/login').send({
      username: mgr.username, password: 'testpass123',
    });
    if (!loginRes.body?.data?.token) throw new Error('Login failed: ' + JSON.stringify(loginRes.body));
    token = loginRes.body.data.token;
  });

  afterAll(async () => {
    if (qrId) {
      await prisma.qRScan.deleteMany({ where: { qrCodeId: qrId } });
      await prisma.qRCode.deleteMany({ where: { id: qrId } });
    }
    if (managerId) {
      await prisma.dashboardManagerHotel.deleteMany({ where: { managerId } });
      await prisma.dashboardManager.deleteMany({ where: { id: managerId } });
    }
    await prisma.$disconnect();
  });

  it('dashboard can generate QR with correct deep link format', async () => {
    const res = await request(app)
      .post(`/api/dashboard/hotels/${hotelId}/qr/generate`)
      .set('Authorization', `Bearer ${token}`)
      .send({ roomNumber: 'SMOKE-99', label: 'Smoke Test Room' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);

    const qr = res.body.data;
    qrId = qr.id;

    // source=qr_room and hotel= (not hotelId=) — required by mobile entry router
    expect(qr.deepLink).toMatch(/source=qr_room/);
    expect(qr.deepLink).toMatch(/hotel=/);
    expect(qr.deepLink).not.toMatch(/hotelId=/);
    expect(qr.deepLink).toContain(`room=SMOKE-99`);
  });

  it('dashboard can list QR codes', async () => {
    const res = await request(app)
      .get(`/api/dashboard/hotels/${hotelId}/qr`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    const found = res.body.data.find((q: any) => q.roomNumber === 'SMOKE-99');
    expect(found).toBeDefined();
    expect(found.deepLink).toMatch(/source=qr_room/);
  });
});
