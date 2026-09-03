import { Router } from 'express';
import {
  createCampaign,
  createTask,
  getCampaigns,
  updateTask,
} from '../controllers/campaign.controller';
import { requireManager, requireWriter } from '../middlewares/auth';
import { writeLimiter } from '../middlewares/rateLimits';
import { validate } from '../middlewares/validate';
import {
  createCampaignSchema,
  createFieldTaskSchema,
  idParam,
  updateFieldTaskSchema,
} from '../schemas';

const router = Router();

router.get('/', getCampaigns);

router.post(
  '/',
  writeLimiter,
  requireManager,
  validate(createCampaignSchema),
  createCampaign
);

router.post(
  '/tasks',
  writeLimiter,
  requireManager,
  validate(createFieldTaskSchema),
  createTask
);

// Field agents update the status of their own tasks, so a writer seat is
// enough here.
router.put(
  '/tasks/:id',
  writeLimiter,
  requireWriter,
  validate(idParam, 'params'),
  validate(updateFieldTaskSchema),
  updateTask
);

export default router;
