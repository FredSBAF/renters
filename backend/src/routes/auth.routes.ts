import { Router } from 'express';
import * as AuthController from '../controllers/AuthController';
import { authMiddleware } from '../middlewares/auth.middleware';
import { authLimiter, forgotPasswordLimiter, registerLimiter } from '../middlewares/rateLimiter.middleware';

const router = Router();

router.post('/register', registerLimiter, AuthController.register);
router.post('/verify-email', AuthController.verifyEmail);
router.post('/login', authLimiter, AuthController.login);
router.post('/refresh', AuthController.refresh);
router.post('/logout', authMiddleware, AuthController.logout);
router.post('/forgot-password', forgotPasswordLimiter, AuthController.forgotPassword);
router.post('/reset-password', AuthController.resetPassword);

export default router;
