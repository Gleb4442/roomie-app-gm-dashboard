import { Router } from 'express';
import * as ctrl from './staff.controller';
import { authenticateDashboardManager } from '../../shared/middleware/dashboardAuth';

// These routes are mounted under /api/dashboard/staff
// and protected by dashboard JWT
const router = Router();

router.use(authenticateDashboardManager);

// ── Specific paths first (before parameterized routes) ────────

// TMS stats for a hotel (must come before /:hotelId/:staffId)
router.get('/:hotelId/stats', ctrl.getStaffStats);

// Template management
router.get('/:hotelId/templates', ctrl.listTemplatesDashboard);
router.post('/:hotelId/templates', ctrl.createTemplateDashboard);
router.patch('/:hotelId/templates/:templateId', ctrl.updateTemplateDashboard);
router.delete('/:hotelId/templates/:templateId', ctrl.deleteTemplateDashboard);

// ── Parameterized staff routes ─────────────────────────────────

router.get('/:hotelId', ctrl.listStaff);
router.post('/:hotelId', ctrl.createStaff);
router.patch('/:hotelId/:staffId', ctrl.updateStaff);
router.delete('/:hotelId/:staffId', ctrl.deactivateStaff);
router.post('/:hotelId/:staffId/reset-pin', ctrl.resetPin);

export default router;
