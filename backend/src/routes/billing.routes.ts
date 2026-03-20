import { Router } from 'express';
import { BillingController } from '../controllers/BillingController';
import { authMiddleware, requireRole } from '../middlewares/auth.middleware';

const router = Router();

router.use(authMiddleware);

router.post('/checkout', requireRole('agency_owner'), BillingController.createCheckoutSession);
router.post('/portal', requireRole('agency_owner'), BillingController.createPortalSession);
router.get('/status', requireRole('agency_owner', 'agency_agent'), BillingController.getBillingStatus);
router.get('/logs', requireRole('admin'), BillingController.getPaymentLogs);
router.get('/logs/export.csv', requireRole('admin'), BillingController.exportPaymentLogsCsv);

export default router;
