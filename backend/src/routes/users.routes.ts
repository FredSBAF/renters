import { Router } from 'express';
import * as UserController from '../controllers/UserController';
import * as AuthController from '../controllers/AuthController';
import { authMiddleware } from '../middlewares/auth.middleware';
import { exportLimiter } from '../middlewares/rateLimiter.middleware';
import { GDPRController } from '../controllers/GDPRController';

const router = Router();

router.get('/me', authMiddleware, UserController.getMe);
router.patch('/me', authMiddleware, UserController.patchMe);
router.post('/me/enable-2fa', authMiddleware, AuthController.enable2fa);
router.post('/me/verify-2fa', authMiddleware, AuthController.verify2fa);
router.post('/me/disable-2fa', authMiddleware, AuthController.disable2fa);
router.get('/me/data-export', authMiddleware, exportLimiter, GDPRController.requestDataExport);
router.post('/me/delete-account', authMiddleware, GDPRController.requestDeletion);
router.get('/me/consents', authMiddleware, GDPRController.getConsents);
router.post('/me/cancel-deletion', GDPRController.cancelDeletion);

export default router;
