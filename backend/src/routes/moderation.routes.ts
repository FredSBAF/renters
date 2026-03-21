import { Router } from 'express';
import { ModerationController } from '../controllers/ModerationController';
import { authMiddleware, requireRole } from '../middlewares/auth.middleware';

const router = Router();

router.use(authMiddleware);
router.use(requireRole('admin'));

router.get('/', ModerationController.getQueue);
router.post('/:queueId/assign', ModerationController.assignItem);
router.post('/:queueId/resolve', ModerationController.resolveItem);
router.post('/:queueId/request-info', ModerationController.requestMoreInfo);
router.post('/trigger/:folderId', ModerationController.triggerAnalysis);

export default router;
