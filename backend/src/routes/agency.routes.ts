import { Router } from 'express';
import { AgencyController } from '../controllers/AgencyController';
import {
  authMiddleware,
  requireAgency2FA,
  requireRole,
} from '../middlewares/auth.middleware';
import { agencyApiLimiter, registerLimiter } from '../middlewares/rateLimiter.middleware';
import { agencySubscriptionCheck } from '../middlewares/security.middleware';

const router = Router();

router.use(agencyApiLimiter);
router.post('/register', registerLimiter, AgencyController.register);
router.post('/join', AgencyController.joinByToken);

router.use(authMiddleware);
router.use(requireAgency2FA);
router.use(agencySubscriptionCheck);

router.get('/me', requireRole('agency_owner', 'agency_agent'), AgencyController.getMyAgency);
router.post(
  '/team/invite',
  requireRole('agency_owner'),
  AgencyController.inviteAgent
);
router.delete(
  '/team/:userId',
  requireRole('agency_owner'),
  AgencyController.removeAgent
);
router.get('/team', requireRole('agency_owner', 'agency_agent'), AgencyController.getTeam);

export default router;
