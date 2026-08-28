import { Router } from 'express';
import {
  getReminders,
  createReminder,
  updateReminder,
  deleteReminder,
  toggleReminderCompleted,
} from '../controllers/reminder.controller';

const router = Router();

router.route('/').get(getReminders).post(createReminder);
router.route('/:id').put(updateReminder).delete(deleteReminder);
router.route('/:id/toggle').put(toggleReminderCompleted);

export default router;
