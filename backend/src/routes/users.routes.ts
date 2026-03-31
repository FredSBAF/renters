import { Router } from 'express';
import * as UsersController from '../controllers/users.controller';
import * as AuthController from '../controllers/AuthController';
import { requireAuth } from '../middlewares/auth.middleware';
import { exportLimiter } from '../middlewares/rateLimiter.middleware';
import { GDPRController } from '../controllers/GDPRController';
import { csrfOriginCheck } from '../middlewares/csrf.middleware';

const router = Router();

router.use(requireAuth);
router.get('/me', UsersController.getMe);
router.patch('/me', csrfOriginCheck, UsersController.updateMe);
router.post('/me/enable-2fa', AuthController.enable2fa);
router.post('/me/verify-2fa', AuthController.verify2fa);
router.post('/me/disable-2fa', AuthController.disable2fa);
router.get('/me/data-export', exportLimiter, GDPRController.requestDataExport);
router.post('/me/delete-account', GDPRController.requestDeletion);
router.get('/me/consents', GDPRController.getConsents);
router.post('/me/cancel-deletion', GDPRController.cancelDeletion);

export default router;
