import { Router } from 'express';
import authRoutes from './auth.routes';
import usersRoutes from './users.routes';
import agencyRouter from './agency.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/users', usersRoutes);
router.use('/agencies', agencyRouter);

export default router;
