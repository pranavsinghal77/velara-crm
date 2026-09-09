import { Router } from 'express';
import {
  deleteMeeting,
  disconnect,
  getCalendar,
  getStatus,
  scheduleMeeting,
  sendEmail,
  startConnect,
} from '../controllers/microsoft.controller';
import { requireWriter } from '../middlewares/auth';
import { writeLimiter } from '../middlewares/rateLimits';
import { validate } from '../middlewares/validate';
import { microsoftCalendarQuery, microsoftMailSchema, microsoftMeetingSchema } from '../schemas';

const router = Router();

// Connecting is a personal action — each user links their own mailbox — so any
// user who can act on leads may do it; there is no cross-user reach.
router.get('/status', getStatus);
router.post('/connect', writeLimiter, startConnect);
router.delete('/connection', writeLimiter, disconnect);

// Sending mail and booking meetings is ordinary sales work.
router.post('/mail', writeLimiter, requireWriter, validate(microsoftMailSchema), sendEmail);
router.get('/calendar', validate(microsoftCalendarQuery, 'query'), getCalendar);
router.post('/meetings', writeLimiter, requireWriter, validate(microsoftMeetingSchema), scheduleMeeting);
router.delete('/meetings/:id', writeLimiter, requireWriter, deleteMeeting);

export default router;
