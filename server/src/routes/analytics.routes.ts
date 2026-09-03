import { Router } from 'express';
import {
  getLeaderboard,
  getOverview,
  getTrend,
} from '../controllers/analytics.controller';

const router = Router();

router.get('/overview', getOverview);
router.get('/trend', getTrend);
router.get('/leaderboard', getLeaderboard);

export default router;
