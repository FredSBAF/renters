import { Router } from 'express';
import { FolderController } from '../controllers/FolderController';
import { authMiddleware, requireRole } from '../middlewares/auth.middleware';

const router = Router();

router.get('/document-types', authMiddleware, requireRole('tenant'), FolderController.getDocumentTypes);

router.use(authMiddleware);
router.use(requireRole('tenant'));

router.get('/me', FolderController.getMyFolder);
router.get('/me/kpis', FolderController.getMyDashboardKpis);
router.patch('/me/status', FolderController.updateFolderStatus);
router.get('/me/completion', FolderController.getFolderCompletion);
router.get('/required-documents', FolderController.getRequiredDocuments);

export default router;
