import { Router } from 'express';
import {
  createNotification,
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../controllers/notification.controller';
import { requireManager } from '../middlewares/auth';
import { writeLimiter } from '../middlewares/rateLimits';
import { validate } from '../middlewares/validate';
import { createNotificationSchema, idParam, paginationQuery } from '../schemas';

const router = Router();

router.get('/', validate(paginationQuery, 'query'), getNotifications);

router.post(
  '/',
  writeLimiter,
  requireManager,
  validate(createNotificationSchema),
  createNotification
);

router.put('/read-all', writeLimiter, markAllNotificationsRead);
router.put('/:id/read', writeLimiter, validate(idParam, 'params'), markNotificationRead);

export default router;
