import { Router } from 'express';
import {
  createReminder,
  deleteReminder,
  getReminders,
  toggleReminderCompleted,
  updateReminder,
} from '../controllers/reminder.controller';
import { requireWriter } from '../middlewares/auth';
import { writeLimiter } from '../middlewares/rateLimits';
import { validate } from '../middlewares/validate';
import {
  createReminderSchema,
  idParam,
  reminderListQuery,
  updateReminderSchema,
} from '../schemas';

const router = Router();

router.get('/', validate(reminderListQuery, 'query'), getReminders);

router.post(
  '/',
  writeLimiter,
  requireWriter,
  validate(createReminderSchema),
  createReminder
);

router.put(
  '/:id/toggle',
  writeLimiter,
  requireWriter,
  validate(idParam, 'params'),
  toggleReminderCompleted
);

router.put(
  '/:id',
  writeLimiter,
  requireWriter,
  validate(idParam, 'params'),
  validate(updateReminderSchema),
  updateReminder
);

router.delete(
  '/:id',
  writeLimiter,
  requireWriter,
  validate(idParam, 'params'),
  deleteReminder
);

export default router;
