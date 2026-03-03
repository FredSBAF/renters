import { Router } from 'express';
import * as UserController from '../controllers/UserController';
import * as AuthController from '../controllers/AuthController';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();

router.get('/me', authMiddleware, UserController.getMe);
router.patch('/me', authMiddleware, UserController.patchMe);
router.post('/me/enable-2fa', authMiddleware, AuthController.enable2fa);
router.post('/me/verify-2fa', authMiddleware, AuthController.verify2fa);
router.post('/me/disable-2fa', authMiddleware, AuthController.disable2fa);

export default router;
