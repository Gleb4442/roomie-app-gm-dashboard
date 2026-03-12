/**
 * E2E Tests — QR Code Generator
 *
 * Covers full QR lifecycle:
 *   Dashboard: generate, list, pdf-download, zip-download
 *   Admin:     generate, bulk-generate, list, delete, regenerate
 *   Public:    fallback page (/qr/:id)
 *   Service:   duplicate room upsert, scan tracking
 */

import request from 'supertest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import { v4 as uuid } from 'uuid';
import app from '../../app';
import { prisma } from '../../config/database';
import { env } from '../../config/environment';

// ── Helpers ───────────────────────────────────────────────────────────────────

function adminJwt(): string {
  return jwt.sign({ adminId: 'test-admin', role: 'super_admin' }, env.adminJwtSecret, {
    expiresIn: '1h',
  });
}

// ── Shared state ──────────────────────────────────────────────────────────────

let hotelId: string;
let dashboardToken: string;
let managerId: string;
/** Tracks all QR IDs created during tests for cleanup */
const createdQrIds: string[] = [];

// ── Setup / teardown ──────────────────────────────────────────────────────────

beforeAll(async () => {
  const hotel = await prisma.hotel.findFirst();
  if (!hotel) throw new Error('No hotel in DB — run seed first');
  hotelId = hotel.id;

  const passwordHash = await bcrypt.hash('qr-test-pw', 10);
  const mgr = await prisma.dashboardManager.create({
    data: { username: `qr-e2e-${uuid().slice(0, 8)}`, passwordHash, role: 'manager' },
  });
  managerId = mgr.id;
  await prisma.dashboardManagerHotel.create({ data: { managerId, hotelId } });

  const loginRes = await request(app)
    .post('/api/dashboard/auth/login')
    .send({ username: mgr.username, password: 'qr-test-pw' });

  if (!loginRes.body?.data?.token) {
    throw new Error('Dashboard login failed: ' + JSON.stringify(loginRes.body));
  }
  dashboardToken = loginRes.body.data.token;
}, 15000);

afterAll(async () => {
  if (createdQrIds.length) {
    await prisma.qRScan.deleteMany({ where: { qrCodeId: { in: createdQrIds } } });
    await prisma.qRCode.deleteMany({ where: { id: { in: createdQrIds } } });
  }
  if (managerId) {
    await prisma.dashboardManagerHotel.deleteMany({ where: { managerId } });
    await prisma.dashboardManager.deleteMany({ where: { id: managerId } });
  }
  await prisma.$disconnect();
});

// ── Dashboard QR: generate ────────────────────────────────────────────────────

describe('Dashboard: POST /api/dashboard/hotels/:hotelId/qr/generate', () => {
  it('generates a QR code and returns correct shape', async () => {
    const res = await request(app)
      .post(`/api/dashboard/hotels/${hotelId}/qr/generate`)
      .set('Authorization', `Bearer ${dashboardToken}`)
      .send({ roomNumber: 'QR-E2E-01', label: 'E2E Test Room' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);

    const qr = res.body.data;
    createdQrIds.push(qr.id);

    expect(qr.hotelId).toBe(hotelId);
    expect(qr.roomNumber).toBe('QR-E2E-01');
    expect(qr.label).toBe('E2E Test Room');
    expect(qr.type).toBe('in_room');
    expect(qr.isActive).toBe(true);
    expect(qr.scanCount).toBe(0);
    expect(typeof qr.deepLink).toBe('string');
    expect(typeof qr.qrImagePath).toBe('string');
    expect(typeof qr.pdfPath).toBe('string');
  }, 30000);

  it('deep link contains source=qr_room and hotel= (not hotelId=)', async () => {
    const res = await request(app)
      .post(`/api/dashboard/hotels/${hotelId}/qr/generate`)
      .set('Authorization', `Bearer ${dashboardToken}`)
      .send({ roomNumber: 'QR-E2E-02' });

    expect(res.status).toBe(201);
    const { deepLink, id } = res.body.data;
    createdQrIds.push(id);

    expect(deepLink).toContain('source=qr_room');
    expect(deepLink).toContain(`hotel=${hotelId}`);
    expect(deepLink).not.toContain('hotelId=');
    expect(deepLink).toContain('room=QR-E2E-02');
  }, 30000);

  it('uses default label (Кімната <n>) when label is omitted', async () => {
    const res = await request(app)
      .post(`/api/dashboard/hotels/${hotelId}/qr/generate`)
      .set('Authorization', `Bearer ${dashboardToken}`)
      .send({ roomNumber: 'QR-NOLABEL' });

    expect(res.status).toBe(201);
    const qr = res.body.data;
    createdQrIds.push(qr.id);
    expect(qr.label).toContain('QR-NOLABEL');
  }, 30000);

  it('returns 400 when roomNumber is missing', async () => {
    const res = await request(app)
      .post(`/api/dashboard/hotels/${hotelId}/qr/generate`)
      .set('Authorization', `Bearer ${dashboardToken}`)
      .send({ label: 'No room number' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 401 without a token', async () => {
    const res = await request(app)
      .post(`/api/dashboard/hotels/${hotelId}/qr/generate`)
      .send({ roomNumber: '999' });

    expect(res.status).toBe(401);
  });

  it('re-generating the same room updates the existing record (upsert)', async () => {
    const ROOM = `QR-UPSERT-${uuid().slice(0, 6)}`;

    const r1 = await request(app)
      .post(`/api/dashboard/hotels/${hotelId}/qr/generate`)
      .set('Authorization', `Bearer ${dashboardToken}`)
      .send({ roomNumber: ROOM, label: 'First Label' });

    expect(r1.status).toBe(201);
    const id1 = r1.body.data.id;
    createdQrIds.push(id1);

    const r2 = await request(app)
      .post(`/api/dashboard/hotels/${hotelId}/qr/generate`)
      .set('Authorization', `Bearer ${dashboardToken}`)
      .send({ roomNumber: ROOM, label: 'Second Label' });

    expect(r2.status).toBe(201);
    const qr2 = r2.body.data;
    // Same ID — upsert, not duplicate
    expect(qr2.id).toBe(id1);
    expect(qr2.label).toBe('Second Label');
    expect(qr2.isActive).toBe(true);
  }, 60000); // two PDF generations ~30s each

  it('PNG and PDF files are actually written to disk', async () => {
    const res = await request(app)
      .post(`/api/dashboard/hotels/${hotelId}/qr/generate`)
      .set('Authorization', `Bearer ${dashboardToken}`)
      .send({ roomNumber: 'QR-FILES-CHK' });

    expect(res.status).toBe(201);
    const qr = res.body.data;
    createdQrIds.push(qr.id);

    expect(fs.existsSync(qr.qrImagePath)).toBe(true);
    expect(fs.existsSync(qr.pdfPath)).toBe(true);
  }, 30000);
});

// ── Dashboard QR: list ────────────────────────────────────────────────────────

describe('Dashboard: GET /api/dashboard/hotels/:hotelId/qr', () => {
  it('returns an array', async () => {
    const res = await request(app)
      .get(`/api/dashboard/hotels/${hotelId}/qr`)
      .set('Authorization', `Bearer ${dashboardToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('includes previously generated QR code', async () => {
    const ROOM = `QR-LIST-${uuid().slice(0, 6)}`;
    const genRes = await request(app)
      .post(`/api/dashboard/hotels/${hotelId}/qr/generate`)
      .set('Authorization', `Bearer ${dashboardToken}`)
      .send({ roomNumber: ROOM, label: 'List Test' });

    createdQrIds.push(genRes.body.data.id);

    const listRes = await request(app)
      .get(`/api/dashboard/hotels/${hotelId}/qr`)
      .set('Authorization', `Bearer ${dashboardToken}`);

    expect(listRes.status).toBe(200);
    const found = listRes.body.data.find((q: any) => q.roomNumber === ROOM);
    expect(found).toBeDefined();
    expect(found.label).toBe('List Test');
  }, 30000);

  it('returns 401 without token', async () => {
    const res = await request(app).get(`/api/dashboard/hotels/${hotelId}/qr`);
    expect(res.status).toBe(401);
  });
});

// ── Dashboard QR: PDF download ────────────────────────────────────────────────

describe('Dashboard: GET /api/dashboard/hotels/:hotelId/qr/:qrId/pdf', () => {
  let testQrId: string;

  beforeAll(async () => {
    const res = await request(app)
      .post(`/api/dashboard/hotels/${hotelId}/qr/generate`)
      .set('Authorization', `Bearer ${dashboardToken}`)
      .send({ roomNumber: `QR-PDF-${uuid().slice(0, 6)}`, label: 'PDF Test' });
    testQrId = res.body.data.id;
    createdQrIds.push(testQrId);
  }, 30000);

  it('returns a PDF with Authorization header', async () => {
    const res = await request(app)
      .get(`/api/dashboard/hotels/${hotelId}/qr/${testQrId}/pdf`)
      .set('Authorization', `Bearer ${dashboardToken}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/pdf');
    expect(res.headers['content-disposition']).toContain('.pdf');
  });

  it('returns a PDF when token is passed as query param', async () => {
    const res = await request(app)
      .get(`/api/dashboard/hotels/${hotelId}/qr/${testQrId}/pdf?token=${dashboardToken}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/pdf');
  });

  it('returns 404 for unknown QR id', async () => {
    const res = await request(app)
      .get(`/api/dashboard/hotels/${hotelId}/qr/${uuid()}/pdf`)
      .set('Authorization', `Bearer ${dashboardToken}`);

    expect(res.status).toBe(404);
  });

  it('returns 401 without token', async () => {
    const res = await request(app)
      .get(`/api/dashboard/hotels/${hotelId}/qr/${testQrId}/pdf`);
    expect(res.status).toBe(401);
  });
});

// ── Dashboard QR: ZIP download ────────────────────────────────────────────────

describe('Dashboard: GET /api/dashboard/hotels/:hotelId/qr/download-all', () => {
  it('returns a ZIP when QR codes exist', async () => {
    const genRes = await request(app)
      .post(`/api/dashboard/hotels/${hotelId}/qr/generate`)
      .set('Authorization', `Bearer ${dashboardToken}`)
      .send({ roomNumber: `QR-ZIP-${uuid().slice(0, 6)}` });
    createdQrIds.push(genRes.body.data.id);

    const res = await request(app)
      .get(`/api/dashboard/hotels/${hotelId}/qr/download-all`)
      .set('Authorization', `Bearer ${dashboardToken}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/zip');
    expect(res.headers['content-disposition']).toContain('.zip');
  }, 30000);

  it('returns a ZIP when token is passed as query param', async () => {
    const res = await request(app)
      .get(`/api/dashboard/hotels/${hotelId}/qr/download-all?token=${dashboardToken}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/zip');
  });
});

// ── Admin QR: generate ────────────────────────────────────────────────────────

describe('Admin: POST /api/admin/hotels/:hotelId/qr/generate', () => {
  it('generates QR via admin API', async () => {
    const res = await request(app)
      .post(`/api/admin/hotels/${hotelId}/qr/generate`)
      .set('Authorization', `Bearer ${adminJwt()}`)
      .send({ type: 'in_room', label: 'Admin QR Room', roomNumber: `ADM-${uuid().slice(0, 6)}` });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    const qr = res.body.data;
    createdQrIds.push(qr.id);

    expect(qr.hotelId).toBe(hotelId);
    expect(qr.isActive).toBe(true);
    expect(typeof qr.deepLink).toBe('string');
  }, 30000);

  it('returns 401 with wrong admin secret', async () => {
    const badToken = jwt.sign({ adminId: 'x', role: 'super_admin' }, 'wrong-secret', {
      expiresIn: '1h',
    });
    const res = await request(app)
      .post(`/api/admin/hotels/${hotelId}/qr/generate`)
      .set('Authorization', `Bearer ${badToken}`)
      .send({ type: 'lobby', label: 'Lobby', roomNumber: 'L1' });

    expect(res.status).toBe(401);
  });
});

// ── Admin QR: bulk generate ───────────────────────────────────────────────────

describe('Admin: POST /api/admin/hotels/:hotelId/qr/generate-bulk', () => {
  it('generates multiple QR codes from object array', async () => {
    const rooms = [
      { number: `BULK-A-${uuid().slice(0, 4)}` },
      { number: `BULK-B-${uuid().slice(0, 4)}` },
    ];

    const res = await request(app)
      .post(`/api/admin/hotels/${hotelId}/qr/generate-bulk`)
      .set('Authorization', `Bearer ${adminJwt()}`)
      .send({ rooms });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);

    const { qrCodes } = res.body.data;
    expect(Array.isArray(qrCodes)).toBe(true);
    expect(qrCodes).toHaveLength(2);

    for (const qr of qrCodes) {
      createdQrIds.push(qr.id);
      expect(qr.isActive).toBe(true);
    }
  }, 60000); // 2 × ~15s

  it('generates multiple QR codes from plain string array', async () => {
    const rooms = [`STR-${uuid().slice(0, 4)}`, `STR-${uuid().slice(0, 4)}`];

    const res = await request(app)
      .post(`/api/admin/hotels/${hotelId}/qr/generate-bulk`)
      .set('Authorization', `Bearer ${adminJwt()}`)
      .send({ rooms });

    expect(res.status).toBe(201);
    const { qrCodes } = res.body.data;
    expect(qrCodes).toHaveLength(2);
    qrCodes.forEach((qr: any) => createdQrIds.push(qr.id));
  }, 60000);

  it('returns 400 when rooms field is missing', async () => {
    const res = await request(app)
      .post(`/api/admin/hotels/${hotelId}/qr/generate-bulk`)
      .set('Authorization', `Bearer ${adminJwt()}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when rooms array is empty', async () => {
    const res = await request(app)
      .post(`/api/admin/hotels/${hotelId}/qr/generate-bulk`)
      .set('Authorization', `Bearer ${adminJwt()}`)
      .send({ rooms: [] });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

// ── Admin QR: list ────────────────────────────────────────────────────────────

describe('Admin: GET /api/admin/hotels/:hotelId/qr', () => {
  it('returns array of QR codes', async () => {
    const res = await request(app)
      .get(`/api/admin/hotels/${hotelId}/qr`)
      .set('Authorization', `Bearer ${adminJwt()}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

// ── Admin QR: delete ──────────────────────────────────────────────────────────

describe('Admin: DELETE /api/admin/hotels/:hotelId/qr/:qrId', () => {
  it('deletes a QR code and its files', async () => {
    const genRes = await request(app)
      .post(`/api/admin/hotels/${hotelId}/qr/generate`)
      .set('Authorization', `Bearer ${adminJwt()}`)
      .send({ type: 'lobby', label: 'To Delete', roomNumber: `DEL-${uuid().slice(0, 6)}` });

    expect(genRes.status).toBe(201);
    const { id, qrImagePath, pdfPath } = genRes.body.data;

    const deleteRes = await request(app)
      .delete(`/api/admin/hotels/${hotelId}/qr/${id}`)
      .set('Authorization', `Bearer ${adminJwt()}`);

    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.success).toBe(true);

    // Removed from DB
    const dbRecord = await prisma.qRCode.findUnique({ where: { id } });
    expect(dbRecord).toBeNull();

    // Files removed from disk
    expect(fs.existsSync(qrImagePath)).toBe(false);
    expect(fs.existsSync(pdfPath)).toBe(false);
  }, 30000);

  it('returns 404 for unknown QR id', async () => {
    const res = await request(app)
      .delete(`/api/admin/hotels/${hotelId}/qr/${uuid()}`)
      .set('Authorization', `Bearer ${adminJwt()}`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});

// ── Admin QR: regenerate all ──────────────────────────────────────────────────

describe('Admin: POST /api/admin/hotels/:hotelId/qr/regenerate', () => {
  // Use a dedicated isolated hotel so we only regenerate 1 QR, not all test QRs
  let isoHotelId: string;
  let isoQrId: string;

  beforeAll(async () => {
    const isoHotel = await prisma.hotel.create({
      data: {
        name: `ISO Hotel ${uuid().slice(0, 6)}`,
        slug: `iso-hotel-${uuid().slice(0, 6)}`,
        location: 'Test',
        timezone: 'UTC',
      },
    });
    isoHotelId = isoHotel.id;

    // Generate exactly one QR in this hotel
    const qrRes = await request(app)
      .post(`/api/admin/hotels/${isoHotelId}/qr/generate`)
      .set('Authorization', `Bearer ${adminJwt()}`)
      .send({ type: 'in_room', label: 'Regen Room', roomNumber: 'REGEN-1' });
    isoQrId = qrRes.body.data.id;
  }, 30000);

  afterAll(async () => {
    if (isoQrId) {
      await prisma.qRScan.deleteMany({ where: { qrCodeId: isoQrId } });
      await prisma.qRCode.deleteMany({ where: { id: isoQrId } });
    }
    if (isoHotelId) await prisma.hotel.delete({ where: { id: isoHotelId } });
  });

  it('regenerates all active QR codes in a hotel', async () => {
    const res = await request(app)
      .post(`/api/admin/hotels/${isoHotelId}/qr/regenerate`)
      .set('Authorization', `Bearer ${adminJwt()}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toContain('regenerated');

    // Files should still exist after regen
    const qr = await prisma.qRCode.findUnique({ where: { id: isoQrId } });
    expect(qr?.qrImagePath).toBeTruthy();
    expect(fs.existsSync(qr!.qrImagePath!)).toBe(true);
  }, 30000);
});

// ── Public: QR fallback page ──────────────────────────────────────────────────

describe('Public: GET /qr/:qrCodeId', () => {
  let publicQrId: string;

  beforeAll(async () => {
    const res = await request(app)
      .post(`/api/dashboard/hotels/${hotelId}/qr/generate`)
      .set('Authorization', `Bearer ${dashboardToken}`)
      .send({ roomNumber: `QR-PUBLIC-${uuid().slice(0, 6)}` });
    publicQrId = res.body.data.id;
    createdQrIds.push(publicQrId);
  }, 30000);

  it('serves HTML fallback page for valid QR id', async () => {
    const res = await request(app).get(`/qr/${publicQrId}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.text).toContain('roomie://');
  });

  it('increments scanCount after visit', async () => {
    const before = await prisma.qRCode.findUnique({ where: { id: publicQrId } });
    const scansBefore = before!.scanCount;

    await request(app).get(`/qr/${publicQrId}`);

    const after = await prisma.qRCode.findUnique({ where: { id: publicQrId } });
    expect(after!.scanCount).toBe(scansBefore + 1);
  });

  it('returns 404 for unknown QR id', async () => {
    const res = await request(app).get(`/qr/${uuid()}`);
    expect(res.status).toBe(404);
  });
});
