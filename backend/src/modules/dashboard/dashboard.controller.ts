import { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import { DashboardRequest } from '../../shared/middleware/dashboardAuth';
import {
  dashboardAuthService,
  dashboardOverviewService,
  dashboardGuestsService,
  dashboardOrdersService,
  dashboardStatsService,
  dashboardSmsLogsService,
  dashboardBookingsService,
  dashboardSettingsService,
  dashboardServiceCatalogService,
  dashboardGuestDetailService,
  dashboardReviewsService,
  dashboardOffersService,
  dashboardNotificationsService,
} from './dashboard.service';
import { qrService } from '../qr/qrService';
import { qrPdfGenerator } from '../qr/qrPdfGenerator';
import { taskStaffService } from '../task/taskService';
import { redis } from '../../config/redis';
import { logger } from '../../shared/utils/logger';

export const dashboardController = {
  // ── Auth ───────────────────────────────────────────────────────────────────
  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { username, password } = req.body;
      const result = await dashboardAuthService.login(username, password);
      res.json({ success: true, data: result });
    } catch (err) { next(err); }
  },

  // ── Delete Account ─────────────────────────────────────────────────────────
  async deleteAccount(req: DashboardRequest, res: Response, next: NextFunction) {
    try {
      const managerId = req.manager!.id;
      const result = await dashboardAuthService.deleteAccount(managerId);
      res.json({ success: true, data: result });
    } catch (err) { next(err); }
  },

  // ── Overview ───────────────────────────────────────────────────────────────
  async overview(req: DashboardRequest, res: Response, next: NextFunction) {
    try {
      const data = await dashboardOverviewService.get(req.params.hotelId as string);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  },

  // ── Guests ─────────────────────────────────────────────────────────────────
  async guests(req: DashboardRequest, res: Response, next: NextFunction) {
    try {
      const data = await dashboardGuestsService.list(req.params.hotelId as string, {
        stage: req.query.stage as string,
        search: req.query.search as string,
        page: parseInt(req.query.page as string || '1', 10),
        limit: parseInt(req.query.limit as string || '20', 10),
      });
      res.json({ success: true, data });
    } catch (err) { next(err); }
  },

  // ── Orders ─────────────────────────────────────────────────────────────────
  async orders(req: DashboardRequest, res: Response, next: NextFunction) {
    try {
      const data = await dashboardOrdersService.list(req.params.hotelId as string, {
        status: req.query.status as string,
        date: req.query.date as string,
        page: parseInt(req.query.page as string || '1', 10),
        limit: parseInt(req.query.limit as string || '20', 10),
      });
      res.json({ success: true, data });
    } catch (err) { next(err); }
  },

  // ── Orders SSE Stream ──────────────────────────────────────────────────────
  async ordersStream(req: DashboardRequest, res: Response, _next: NextFunction) {
    const hotelId = req.params.hotelId as string;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const channel = `orders:${hotelId}`;

    // Subscribe to Redis pub/sub
    const subscriber = redis.duplicate();
    subscriber.subscribe(channel).catch(() => {});

    subscriber.on('message', (_ch: string, message: string) => {
      res.write(`data: ${message}\n\n`);
    });

    // Heartbeat every 30 seconds
    const heartbeat = setInterval(() => {
      res.write(': ping\n\n');
    }, 30000);

    req.on('close', () => {
      clearInterval(heartbeat);
      subscriber.unsubscribe(channel).catch(() => {});
      subscriber.quit().catch(() => {});
      logger.debug({ hotelId }, 'Dashboard SSE client disconnected');
    });
  },

  // ── QR ─────────────────────────────────────────────────────────────────────
  async generateQR(req: DashboardRequest, res: Response, next: NextFunction) {
    try {
      const { roomNumber, label } = req.body as { roomNumber: string; label?: string };
      if (!roomNumber) return res.status(400).json({ success: false, error: 'roomNumber is required' });
      const qr = await qrService.generateForRoom(req.params.hotelId as string, roomNumber, label);
      res.status(201).json({ success: true, data: qr });
    } catch (err) { next(err); }
  },

  async generateQRBulk(req: DashboardRequest, res: Response, next: NextFunction) {
    try {
      const { rooms } = req.body as { rooms: { number: string; label?: string }[] };
      if (!Array.isArray(rooms) || !rooms.length) {
        return res.status(400).json({ success: false, error: 'rooms array is required' });
      }
      const result = await qrService.generateBulk(req.params.hotelId as string, rooms);
      res.status(201).json({ success: true, data: { count: result.qrCodes.length } });
    } catch (err) { next(err); }
  },

  async listQR(req: DashboardRequest, res: Response, next: NextFunction) {
    try {
      const qrCodes = await qrService.getByHotel(req.params.hotelId as string);
      res.json({ success: true, data: qrCodes });
    } catch (err) { next(err); }
  },

  async downloadQRPdf(req: DashboardRequest, res: Response, next: NextFunction) {
    try {
      const qrCodes = await qrService.getWithHotelInfo(req.params.hotelId as string);
      const target = qrCodes.find((q) => q.id === (req.params.qrId as string));

      if (!target) {
        return res.status(404).json({ success: false, error: 'QR not found' });
      }

      if (target.pdfPath && fs.existsSync(target.pdfPath)) {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${target.label}.pdf"`);
        return fs.createReadStream(target.pdfPath).pipe(res);
      }

      // Generate on-the-fly if file missing
      const pdfBuffer = await qrPdfGenerator.generate({
        qrImagePath: target.qrImagePath || '',
        roomNumber: target.roomNumber || '',
        hotelName: target.hotelName,
        hotelLogo: target.hotelLogo,
        accentColor: target.accentColor,
        label: target.label,
      });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${target.label}.pdf"`);
      res.send(pdfBuffer);
    } catch (err) { next(err); }
  },

  async downloadAllQRZip(req: DashboardRequest, res: Response, next: NextFunction) {
    try {
      const zipPath = await qrService.createZip(req.params.hotelId as string);

      if (!fs.existsSync(zipPath)) {
        return res.status(404).json({ success: false, error: 'No QR codes found' });
      }

      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="qr-codes-${req.params.hotelId as string}.zip"`);
      fs.createReadStream(zipPath).pipe(res);
    } catch (err) { next(err); }
  },

  // ── Stats ──────────────────────────────────────────────────────────────────
  async stats(req: DashboardRequest, res: Response, next: NextFunction) {
    try {
      const now = new Date();
      const from = (req.query.from as string) || new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const to = (req.query.to as string) || now.toISOString().split('T')[0];
      const data = await dashboardStatsService.get(req.params.hotelId as string, from, to);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  },

  // ── SMS Logs ───────────────────────────────────────────────────────────────
  async smsLogs(req: DashboardRequest, res: Response, next: NextFunction) {
    try {
      const data = await dashboardSmsLogsService.list(req.params.hotelId as string, {
        page: parseInt(req.query.page as string || '1', 10),
        limit: parseInt(req.query.limit as string || '20', 10),
        status: req.query.status as string,
      });
      res.json({ success: true, data });
    } catch (err) { next(err); }
  },

  // ── Service Requests ────────────────────────────────────────────────────────
  async serviceRequests(req: DashboardRequest, res: Response, next: NextFunction) {
    try {
      const hotelId = req.params.hotelId as string;
      const data = await taskStaffService.getHotelRequests(hotelId, {
        status: req.query.status as string,
        categorySlug: req.query.category as string,
        roomNumber: req.query.roomNumber as string,
        from: req.query.from ? new Date(req.query.from as string) : undefined,
        to: req.query.to ? new Date(req.query.to as string) : undefined,
        page: parseInt(req.query.page as string || '1', 10),
        limit: parseInt(req.query.limit as string || '20', 10),
      });
      res.json({ success: true, data });
    } catch (err) { next(err); }
  },

  async updateServiceRequestStatus(req: DashboardRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { status, rejectionReason, scheduledTime } = req.body;
      const data = await taskStaffService.updateStatus(id as string, status, {
        rejectionReason,
        scheduledTime: scheduledTime ? new Date(scheduledTime) : undefined,
      });
      res.json({ success: true, data });
    } catch (err) { next(err); }
  },

  async serviceRequestsStream(req: DashboardRequest, res: Response, _next: NextFunction) {
    const hotelId = req.params.hotelId as string;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const channel = `service_requests:${hotelId}`;
    const subscriber = redis.duplicate();
    subscriber.subscribe(channel).catch(() => {});

    subscriber.on('message', (_ch: string, message: string) => {
      res.write(`data: ${message}\n\n`);
    });

    const heartbeat = setInterval(() => {
      res.write(': ping\n\n');
    }, 30000);

    req.on('close', () => {
      clearInterval(heartbeat);
      subscriber.unsubscribe(channel).catch(() => {});
      subscriber.quit().catch(() => {});
      logger.debug({ hotelId }, 'Service requests SSE client disconnected');
    });
  },

  // ── Bookings ──────────────────────────────────────────────────────────────
  async bookings(req: DashboardRequest, res: Response, next: NextFunction) {
    try {
      const data = await dashboardBookingsService.list(req.params.hotelId as string, {
        stage: req.query.stage as string,
        search: req.query.search as string,
        from: req.query.from as string,
        to: req.query.to as string,
        page: parseInt(req.query.page as string || '1', 10),
        limit: parseInt(req.query.limit as string || '20', 10),
      });
      res.json({ success: true, data });
    } catch (err) { next(err); }
  },

  async serviceStats(req: DashboardRequest, res: Response, next: NextFunction) {
    try {
      const hotelId = req.params.hotelId as string;
      const now = new Date();
      const from = req.query.from
        ? new Date(req.query.from as string)
        : new Date(now.getFullYear(), now.getMonth(), 1);
      const to = req.query.to ? new Date(req.query.to as string) : now;
      const data = await taskStaffService.getStats(hotelId, from, to);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  },

  // ── Hotel Settings ────────────────────────────────────────────────────────
  async getSettings(req: DashboardRequest, res: Response, next: NextFunction) {
    try {
      const data = await dashboardSettingsService.get(req.params.hotelId as string);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  },

  async updateSettings(req: DashboardRequest, res: Response, next: NextFunction) {
    try {
      const data = await dashboardSettingsService.update(req.params.hotelId as string, req.body);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  },

  // ── Service Catalog ─────────────────────────────────────────────────────────
  async serviceCatalog(req: DashboardRequest, res: Response, next: NextFunction) {
    try {
      const data = await dashboardServiceCatalogService.list(req.params.hotelId as string);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  },

  async createServiceCategory(req: DashboardRequest, res: Response, next: NextFunction) {
    try {
      const data = await dashboardServiceCatalogService.createCategory(req.params.hotelId as string, req.body);
      res.status(201).json({ success: true, data });
    } catch (err) { next(err); }
  },

  async updateServiceCategory(req: DashboardRequest, res: Response, next: NextFunction) {
    try {
      const data = await dashboardServiceCatalogService.updateCategory(req.params.catId as string, req.body);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  },

  async deleteServiceCategory(req: DashboardRequest, res: Response, next: NextFunction) {
    try {
      await dashboardServiceCatalogService.deleteCategory(req.params.catId as string);
      res.json({ success: true, message: 'Category deleted' });
    } catch (err) { next(err); }
  },

  async createServiceItem(req: DashboardRequest, res: Response, next: NextFunction) {
    try {
      const data = await dashboardServiceCatalogService.createItem(req.params.catId as string, req.body);
      res.status(201).json({ success: true, data });
    } catch (err) { next(err); }
  },

  async updateServiceItem(req: DashboardRequest, res: Response, next: NextFunction) {
    try {
      const data = await dashboardServiceCatalogService.updateItem(req.params.itemId as string, req.body);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  },

  async deleteServiceItem(req: DashboardRequest, res: Response, next: NextFunction) {
    try {
      await dashboardServiceCatalogService.deleteItem(req.params.itemId as string);
      res.json({ success: true, message: 'Item deleted' });
    } catch (err) { next(err); }
  },

  // ── Guest Detail ──────────────────────────────────────────────────────────
  async guestDetail(req: DashboardRequest, res: Response, next: NextFunction) {
    try {
      const data = await dashboardGuestDetailService.get(req.params.hotelId as string, req.params.guestId as string);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  },

  async addGuestTag(req: DashboardRequest, res: Response, next: NextFunction) {
    try {
      const { tag } = req.body;
      const data = await dashboardGuestDetailService.addTag(req.params.hotelId as string, req.params.guestId as string, tag);
      res.status(201).json({ success: true, data });
    } catch (err) { next(err); }
  },

  async removeGuestTag(req: DashboardRequest, res: Response, next: NextFunction) {
    try {
      await dashboardGuestDetailService.removeTag(req.params.tagId as string);
      res.json({ success: true, message: 'Tag removed' });
    } catch (err) { next(err); }
  },

  // ── Reviews ───────────────────────────────────────────────────────────────
  async reviews(req: DashboardRequest, res: Response, next: NextFunction) {
    try {
      const data = await dashboardReviewsService.list(req.params.hotelId as string, {
        rating: req.query.rating ? parseInt(req.query.rating as string) : undefined,
        page: parseInt(req.query.page as string || '1', 10),
        limit: parseInt(req.query.limit as string || '20', 10),
      });
      res.json({ success: true, data });
    } catch (err) { next(err); }
  },

  async replyReview(req: DashboardRequest, res: Response, next: NextFunction) {
    try {
      const data = await dashboardReviewsService.reply(req.params.reviewId as string, req.body.managerReply);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  },

  // ── Offers ────────────────────────────────────────────────────────────────
  async offers(req: DashboardRequest, res: Response, next: NextFunction) {
    try {
      const data = await dashboardOffersService.list(req.params.hotelId as string, {
        status: req.query.status as string,
        page: parseInt(req.query.page as string || '1', 10),
        limit: parseInt(req.query.limit as string || '20', 10),
      });
      res.json({ success: true, data });
    } catch (err) { next(err); }
  },

  async createOffer(req: DashboardRequest, res: Response, next: NextFunction) {
    try {
      const data = await dashboardOffersService.create(req.params.hotelId as string, req.body);
      res.status(201).json({ success: true, data });
    } catch (err) { next(err); }
  },

  async updateOffer(req: DashboardRequest, res: Response, next: NextFunction) {
    try {
      const data = await dashboardOffersService.update(req.params.offerId as string, req.body);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  },

  async deleteOffer(req: DashboardRequest, res: Response, next: NextFunction) {
    try {
      await dashboardOffersService.delete(req.params.offerId as string);
      res.json({ success: true, message: 'Offer deleted' });
    } catch (err) { next(err); }
  },

  // ── Push Notifications ─────────────────────────────────────────────────────
  async sendNotification(req: DashboardRequest, res: Response, next: NextFunction) {
    try {
      const { title, body, guestId } = req.body;
      if (!title || !body) return res.status(400).json({ success: false, error: 'title and body are required' });
      const data = await dashboardNotificationsService.sendToGuest(
        req.params.hotelId as string, guestId, title, body, req.manager!.id,
      );
      res.status(201).json({ success: true, data });
    } catch (err) { next(err); }
  },

  async broadcastNotification(req: DashboardRequest, res: Response, next: NextFunction) {
    try {
      const { title, body, targetStage } = req.body;
      if (!title || !body) return res.status(400).json({ success: false, error: 'title and body are required' });
      const data = await dashboardNotificationsService.broadcast(
        req.params.hotelId as string, title, body, req.manager!.id, targetStage,
      );
      res.status(201).json({ success: true, data });
    } catch (err) { next(err); }
  },

  async notificationHistory(req: DashboardRequest, res: Response, next: NextFunction) {
    try {
      const data = await dashboardNotificationsService.history(req.params.hotelId as string, {
        page: parseInt(req.query.page as string || '1', 10),
        limit: parseInt(req.query.limit as string || '20', 10),
      });
      res.json({ success: true, data });
    } catch (err) { next(err); }
  },
};
