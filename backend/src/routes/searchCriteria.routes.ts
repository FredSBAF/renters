import { Router } from 'express';
import { requireAuth, requireRole } from '../middlewares/auth.middleware';
import {
  generatePresentation,
  getSearchCriteria,
  updateSearchCriteria,
} from '../controllers/searchCriteria.controller';

const router = Router();

router.use(requireAuth);
router.use(requireRole('tenant'));

router.get('/', getSearchCriteria);
router.patch('/', updateSearchCriteria);
router.post('/generate-presentation', generatePresentation);

export default router;
