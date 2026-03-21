import { Router } from 'express';
import { GuarantorController } from '../controllers/GuarantorController';
import { authMiddleware, optionalAuth, requireRole } from '../middlewares/auth.middleware';

const router = Router();

router.post('/accept', optionalAuth, GuarantorController.acceptInvitation);
router.post('/invite', authMiddleware, requireRole('tenant'), GuarantorController.inviteGuarantor);
router.post('/direct', authMiddleware, requireRole('tenant'), GuarantorController.uploadDirect);
router.get('/', authMiddleware, requireRole('tenant'), GuarantorController.getMyGuarantors);
router.delete('/:guarantorId', authMiddleware, requireRole('tenant'), GuarantorController.removeGuarantor);
router.get(
  '/:guarantorId/folder',
  authMiddleware,
  requireRole('tenant'),
  GuarantorController.getGuarantorFolder
);

export default router;
