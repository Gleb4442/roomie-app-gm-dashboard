import { Router } from 'express';
import { authenticateGuestJWT } from '../../shared/middleware/auth';
import { authenticateDashboardManager } from '../../shared/middleware/dashboardAuth';
import { staysController } from './stays.controller';

const router = Router();

// ── Guest endpoints ────────────────────────────────────────────────────────

// POST /api/stays/:stayId/late-checkout   — request late checkout
router.post('/:stayId/late-checkout', authenticateGuestJWT, staysController.requestLateCheckout);

// GET  /api/stays/:stayId/late-checkout   — get status of latest request
router.get('/:stayId/late-checkout', authenticateGuestJWT, staysController.getLateCheckoutStatus);

// POST /api/stays/:stayId/extend          — request stay extension
router.post('/:stayId/extend', authenticateGuestJWT, staysController.requestExtension);

// ── Dashboard endpoints ────────────────────────────────────────────────────

// PATCH /api/dashboard/stays/requests/:requestId/late-checkout — approve/decline
router.patch(
  '/requests/:requestId/late-checkout',
  authenticateDashboardManager,
  staysController.processLateCheckout,
);

export default router;
