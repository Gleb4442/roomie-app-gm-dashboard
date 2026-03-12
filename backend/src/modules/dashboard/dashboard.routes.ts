import { Router } from 'express';
import { dashboardController } from './dashboard.controller';
import {
  authenticateDashboardManager,
  verifyHotelAccess,
} from '../../shared/middleware/dashboardAuth';

const router = Router();

// ── Auth (public) ─────────────────────────────────────────────────────────────
router.post('/auth/login', dashboardController.login);

// ── Account management ────────────────────────────────────────────────────────
router.delete('/me', authenticateDashboardManager, dashboardController.deleteAccount);

// ── Protected hotel routes ────────────────────────────────────────────────────
// Apply auth + hotel access check to all /hotels/:hotelId/* routes
router.use(
  '/hotels/:hotelId',
  authenticateDashboardManager,
  verifyHotelAccess,
);

// Overview
router.get('/hotels/:hotelId/overview', dashboardController.overview);

// Guests
router.get('/hotels/:hotelId/guests', dashboardController.guests);

// Orders
router.get('/hotels/:hotelId/orders', dashboardController.orders);
router.get('/hotels/:hotelId/orders/stream', dashboardController.ordersStream);

// QR
router.post('/hotels/:hotelId/qr/generate', dashboardController.generateQR);
router.post('/hotels/:hotelId/qr/generate-bulk', dashboardController.generateQRBulk);
router.get('/hotels/:hotelId/qr', dashboardController.listQR);
router.get('/hotels/:hotelId/qr/download-all', dashboardController.downloadAllQRZip);
router.get('/hotels/:hotelId/qr/:qrId/pdf', dashboardController.downloadQRPdf);

// Stats
router.get('/hotels/:hotelId/stats', dashboardController.stats);

// SMS Logs
router.get('/hotels/:hotelId/sms-logs', dashboardController.smsLogs);

// Bookings
router.get('/hotels/:hotelId/bookings', dashboardController.bookings);

// Service Requests
router.get('/hotels/:hotelId/service-requests', dashboardController.serviceRequests);
router.put('/hotels/:hotelId/service-requests/:id/status', dashboardController.updateServiceRequestStatus);
router.get('/hotels/:hotelId/service-requests/stream', dashboardController.serviceRequestsStream);
router.get('/hotels/:hotelId/service-stats', dashboardController.serviceStats);

// Hotel Settings
router.get('/hotels/:hotelId/settings', dashboardController.getSettings);
router.put('/hotels/:hotelId/settings', dashboardController.updateSettings);

// Service Catalog
router.get('/hotels/:hotelId/service-catalog', dashboardController.serviceCatalog);
router.post('/hotels/:hotelId/service-catalog', dashboardController.createServiceCategory);
router.put('/hotels/:hotelId/service-catalog/:catId', dashboardController.updateServiceCategory);
router.delete('/hotels/:hotelId/service-catalog/:catId', dashboardController.deleteServiceCategory);
router.post('/hotels/:hotelId/service-catalog/:catId/items', dashboardController.createServiceItem);
router.put('/hotels/:hotelId/service-catalog/:catId/items/:itemId', dashboardController.updateServiceItem);
router.delete('/hotels/:hotelId/service-catalog/:catId/items/:itemId', dashboardController.deleteServiceItem);

// Guest Detail & Tags
router.get('/hotels/:hotelId/guests/:guestId', dashboardController.guestDetail);
router.post('/hotels/:hotelId/guests/:guestId/tags', dashboardController.addGuestTag);
router.delete('/hotels/:hotelId/guests/:guestId/tags/:tagId', dashboardController.removeGuestTag);

// Reviews
router.get('/hotels/:hotelId/reviews', dashboardController.reviews);
router.put('/hotels/:hotelId/reviews/:reviewId/reply', dashboardController.replyReview);

// Offers
router.get('/hotels/:hotelId/offers', dashboardController.offers);
router.post('/hotels/:hotelId/offers', dashboardController.createOffer);
router.put('/hotels/:hotelId/offers/:offerId', dashboardController.updateOffer);
router.delete('/hotels/:hotelId/offers/:offerId', dashboardController.deleteOffer);

// Push Notifications
router.get('/hotels/:hotelId/notifications', dashboardController.notificationHistory);
router.post('/hotels/:hotelId/notifications/send', dashboardController.sendNotification);
router.post('/hotels/:hotelId/notifications/broadcast', dashboardController.broadcastNotification);

export default router;
