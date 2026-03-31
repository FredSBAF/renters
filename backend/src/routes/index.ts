import { Router } from 'express';
import authRoutes from './auth.routes';
import usersRoutes from './users.routes';
import agencyRouter from './agency.routes';
import folderRouter from './folder.routes';
import documentRouter from './document.routes';
import sharingRouter from './sharing.routes';
import moderationRouter from './moderation.routes';
import guarantorRouter from './guarantor.routes';
import adminRouter from './admin.routes';
import notificationRouter from './notification.routes';
import searchCriteriaRouter from './searchCriteria.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/users', usersRoutes);
router.use('/agencies', agencyRouter);
router.use('/folders', folderRouter);
router.use('/documents', documentRouter);
router.use('/sharing', sharingRouter);
router.use('/admin/moderation', moderationRouter);
router.use('/admin', adminRouter);
router.use('/guarantors', guarantorRouter);
router.use('/notifications', notificationRouter);
router.use('/search-criteria', searchCriteriaRouter);

export default router;
