import { Router } from 'express';
import { getOverview } from '../controllers/analytics.controller';

const router = Router();

router.get('/overview', getOverview);

export default router;
