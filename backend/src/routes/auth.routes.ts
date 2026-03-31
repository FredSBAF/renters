import { Router } from 'express';
import * as AuthController from '../controllers/AuthController';
import { authLimiter, forgotPasswordLimiter, registerLimiter } from '../middlewares/rateLimiter.middleware';
import { csrfOriginCheck } from '../middlewares/csrf.middleware';

const router = Router();

router.post('/register', registerLimiter, AuthController.register);
router.post('/verify-email', AuthController.verifyEmail);
router.post('/login', csrfOriginCheck, authLimiter, AuthController.login);
router.post('/refresh', csrfOriginCheck, AuthController.refresh);
router.post('/logout', csrfOriginCheck, AuthController.logout);
router.post('/forgot-password', forgotPasswordLimiter, AuthController.forgotPassword);
router.post('/reset-password', AuthController.resetPassword);

export default router;
