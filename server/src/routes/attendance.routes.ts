import { Router } from 'express';
import {
  clockIn,
  clockOut,
  getToday,
  listAttendance,
  setMode,
  teamToday,
} from '../controllers/attendance.controller';
import { requireManager, requireWriter } from '../middlewares/auth';
import { writeLimiter } from '../middlewares/rateLimits';
import { validate } from '../middlewares/validate';
import { attendanceListQuery, clockInSchema, setAttendanceModeSchema } from '../schemas';

const router = Router();

// Anyone can see and record their own day; the controller narrows the range
// query to self unless the caller is a manager.
router.get('/today', getToday);
router.get('/', validate(attendanceListQuery, 'query'), listAttendance);

router.post('/clock-in', writeLimiter, requireWriter, validate(clockInSchema), clockIn);
router.post('/clock-out', writeLimiter, requireWriter, clockOut);
router.put('/mode', writeLimiter, requireWriter, validate(setAttendanceModeSchema), setMode);

// Reading the whole team's day is a supervisory view.
router.get('/team-today', requireManager, teamToday);

export default router;
