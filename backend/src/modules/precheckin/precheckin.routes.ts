import { Router } from 'express';
import { authenticateGuestJWT } from '../../shared/middleware/auth';
import { getPreCheckinUrl, getPreCheckinUrlByStay, completePreCheckin, nativeSubmit } from './precheckin.controller';

const router = Router();

router.get('/url', authenticateGuestJWT, getPreCheckinUrl);
router.get('/stays/:stayId/precheckin-url', authenticateGuestJWT, getPreCheckinUrlByStay);
router.post('/complete', authenticateGuestJWT, completePreCheckin);
router.post('/native-submit', authenticateGuestJWT, nativeSubmit);

export default router;
