import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { NotificationController } from '../controllers/NotificationController';

const router = Router();

router.use(authMiddleware);
router.get('/', NotificationController.getNotifications);
router.get('/unread-count', NotificationController.getUnreadCount);
router.patch('/read-all', NotificationController.markAllAsRead);
router.get('/preferences', NotificationController.getPreferences);
router.patch('/preferences', NotificationController.updatePreferences);
router.patch('/:id/read', NotificationController.markAsRead);
router.delete('/:id', NotificationController.deleteNotification);

export default router;
