import { Router } from 'express';
import { SharingController } from '../controllers/SharingController';
import { authMiddleware, optionalAuth, requireRole } from '../middlewares/auth.middleware';
import { agencyApiLimiter, sharingLimiter } from '../middlewares/rateLimiter.middleware';

const router = Router();

router.post('/links', authMiddleware, requireRole('tenant'), sharingLimiter, SharingController.createLink);
router.get('/links', authMiddleware, requireRole('tenant'), SharingController.getMyLinks);
router.delete('/links/:linkId', authMiddleware, requireRole('tenant'), SharingController.revokeLink);
router.patch(
  '/links/:linkId/extend',
  authMiddleware,
  requireRole('tenant'),
  SharingController.extendLink
);
router.get('/history', authMiddleware, requireRole('tenant'), SharingController.getSharingHistory);
router.get('/view/:linkId', optionalAuth, agencyApiLimiter, SharingController.consultFolder);
router.post(
  '/track-download',
  authMiddleware,
  requireRole('agency_owner', 'agency_agent'),
  SharingController.trackDownload
);

export default router;
