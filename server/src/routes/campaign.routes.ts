import { Router } from 'express';
import {
  getCampaigns,
  createCampaign,
  createTask,
  updateTask,
} from '../controllers/campaign.controller';

const router = Router();

router.route('/').get(getCampaigns).post(createCampaign);
router.route('/tasks').post(createTask);
router.route('/tasks/:id').put(updateTask);

export default router;
