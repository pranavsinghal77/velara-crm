import { Router } from 'express';
import {
  changePassword,
  login,
  logout,
  me,
  refresh,
} from '../controllers/auth.controller';
import { requireAuth } from '../middlewares/auth';
import { authLimiter, refreshLimiter } from '../middlewares/rateLimits';
import { validate } from '../middlewares/validate';
import { changePasswordSchema, loginSchema } from '../schemas';

const router = Router();

router.post('/login', authLimiter, validate(loginSchema), login);
router.post('/refresh', refreshLimiter, refresh);
router.post('/logout', logout);

router.get('/me', requireAuth, me);
router.post(
  '/change-password',
  authLimiter,
  requireAuth,
  validate(changePasswordSchema),
  changePassword
);

export default router;
