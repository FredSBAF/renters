import { Router } from 'express';
import { BillingController } from '../controllers/BillingController';

const router = Router();

router.post('/stripe', BillingController.handleStripeWebhook);

export default router;
