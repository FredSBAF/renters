import { Router } from 'express';
import authRoutes from './auth.routes';
import usersRoutes from './users.routes';
import agencyRouter from './agency.routes';
import folderRouter from './folder.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/users', usersRoutes);
router.use('/agencies', agencyRouter);
router.use('/folders', folderRouter);

export default router;
