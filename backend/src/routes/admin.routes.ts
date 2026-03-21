import { Router } from 'express';
import { AdminDashboardController } from '../controllers/AdminDashboardController';
import { AdminUserController } from '../controllers/AdminUserController';
import { authMiddleware, requireRole } from '../middlewares/auth.middleware';
import { exportLimiter } from '../middlewares/rateLimiter.middleware';

const router = Router();

router.use(authMiddleware, requireRole('admin'));

router.get('/dashboard/metrics', AdminDashboardController.getMetrics);
router.get('/dashboard/timeseries', AdminDashboardController.getTimeSeries);
router.get('/dashboard/export', exportLimiter, AdminDashboardController.exportCSV);

router.get('/users', AdminUserController.getUsers);
router.get('/users/:userId', AdminUserController.getUserDetails);
router.post('/users/:userId/suspend', AdminUserController.suspendUser);
router.post('/users/:userId/reactivate', AdminUserController.reactivateUser);
router.delete('/users/:userId', AdminUserController.deleteUser);
router.get('/users/:userId/export', exportLimiter, AdminUserController.exportUserData);
router.patch('/users/:userId/role', AdminUserController.changeRole);

router.get('/audit-logs', AdminUserController.getAuditLogs);

export default router;
