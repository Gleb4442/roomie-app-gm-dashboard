import { Router } from 'express';
import { loyaltyController } from './loyalty.controller';
import { authenticateGuestJWT } from '../../shared/middleware/auth';
import {
  authenticateDashboardManager,
  verifyHotelAccess,
} from '../../shared/middleware/dashboardAuth';

// ── Guest routes: /api/loyalty/:hotelId ──────────────────────────────────────
export const guestLoyaltyRouter = Router({ mergeParams: true });

guestLoyaltyRouter.use(authenticateGuestJWT);

guestLoyaltyRouter.get('/', loyaltyController.getBalance);
guestLoyaltyRouter.get('/history', loyaltyController.getHistory);

// ── Dashboard routes: /api/dashboard/hotels/:hotelId/loyalty ─────────────────
export const dashboardLoyaltyRouter = Router({ mergeParams: true });

dashboardLoyaltyRouter.use(authenticateDashboardManager, verifyHotelAccess);

dashboardLoyaltyRouter.get('/settings', loyaltyController.getSettings);
dashboardLoyaltyRouter.put('/settings', loyaltyController.updateSettings);
dashboardLoyaltyRouter.get('/members', loyaltyController.getMembers);
dashboardLoyaltyRouter.post('/adjust', loyaltyController.manualAdjust);
dashboardLoyaltyRouter.get('/stats', loyaltyController.getStats);
