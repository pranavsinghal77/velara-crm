import { Router } from 'express';
import leadRoutes from './lead.routes';
import messageRoutes from './message.routes';
import campaignRoutes from './campaign.routes';
import userRoutes from './user.routes';
import authRoutes from './auth.routes';
import reminderRoutes from './reminder.routes';
import notificationRoutes from './notification.routes';
import analyticsRoutes from './analytics.routes';
import aiRoutes from './ai';
import seedRoutes from './seed.routes';

const router = Router();

router.use('/leads', leadRoutes);
router.use('/messages', messageRoutes);
router.use('/users', userRoutes);
router.use('/auth', authRoutes);
router.use('/reminders', reminderRoutes);
router.use('/notifications', notificationRoutes);
router.use('/field-campaigns', campaignRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/ai', aiRoutes);
router.use('/seed', seedRoutes);

export default router;
