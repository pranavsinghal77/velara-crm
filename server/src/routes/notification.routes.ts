import { Router } from 'express';
import {
  getNotifications,
  createNotification,
  markNotificationRead,
  markAllNotificationsRead,
} from '../controllers/notification.controller';

const router = Router();

router.route('/').get(getNotifications).post(createNotification);
router.route('/read-all').put(markAllNotificationsRead);
router.route('/:id/read').put(markNotificationRead);

export default router;
