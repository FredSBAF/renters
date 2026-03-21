import { Router } from 'express';
import { DocumentController } from '../controllers/DocumentController';
import { authMiddleware, requireRole } from '../middlewares/auth.middleware';
import { handleUpload } from '../middlewares/upload.middleware';
import { uploadLimiter } from '../middlewares/rateLimiter.middleware';

const router = Router();

router.post('/upload', authMiddleware, requireRole('tenant'), uploadLimiter, handleUpload, DocumentController.upload);
router.get('/', authMiddleware, requireRole('tenant'), DocumentController.getDocuments);
router.get('/:id', authMiddleware, requireRole('tenant'), DocumentController.getDocument);
router.get('/:id/download', authMiddleware, requireRole('tenant'), DocumentController.downloadTenant);
router.get(
  '/:id/download-agency',
  authMiddleware,
  requireRole('agency_owner', 'agency_agent'),
  DocumentController.downloadAgency
);
router.delete('/:id', authMiddleware, requireRole('tenant'), DocumentController.deleteDocument);
router.patch('/:id/comment', authMiddleware, requireRole('tenant'), DocumentController.updateComment);

export default router;
