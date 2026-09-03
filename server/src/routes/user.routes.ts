import { Router } from 'express';
import {
  createUser,
  getUsers,
  toggleUserActive,
  updateUser,
} from '../controllers/user.controller';
import { requireAdmin } from '../middlewares/auth';
import { writeLimiter } from '../middlewares/rateLimits';
import { validate } from '../middlewares/validate';
import { createUserSchema, idParam, updateUserSchema } from '../schemas';

const router = Router();

// Any authenticated member can read the team roster (assignment dropdowns
// need it); only admins can change it.
router.get('/', getUsers);

router.post('/', writeLimiter, requireAdmin, validate(createUserSchema), createUser);

router.put(
  '/:id',
  writeLimiter,
  requireAdmin,
  validate(idParam, 'params'),
  validate(updateUserSchema),
  updateUser
);

router.put(
  '/:id/toggle-active',
  writeLimiter,
  requireAdmin,
  validate(idParam, 'params'),
  toggleUserActive
);

export default router;
