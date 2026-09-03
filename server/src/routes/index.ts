import { Router } from 'express';
import { requireAuth } from '../middlewares/auth';
import aiRoutes from './ai.routes';
import analyticsRoutes from './analytics.routes';
import authRoutes from './auth.routes';
import campaignRoutes from './campaign.routes';
import leadRoutes from './lead.routes';
import messageRoutes from './message.routes';
import notificationRoutes from './notification.routes';
import reminderRoutes from './reminder.routes';
import userRoutes from './user.routes';

const router = Router();

// Auth is the only unauthenticated surface (login / refresh / logout). It
// applies its own guards per route.
router.use('/auth', authRoutes);

// Everything below this line requires a valid access token. Mounting the
// guard once, here, means a newly added route cannot be forgotten and left
// public, which is how the previous build shipped with every endpoint open.
router.use(requireAuth);

router.use('/leads', leadRoutes);
router.use('/messages', messageRoutes);
router.use('/users', userRoutes);
router.use('/reminders', reminderRoutes);
router.use('/notifications', notificationRoutes);
router.use('/field-campaigns', campaignRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/ai', aiRoutes);

export default router;
