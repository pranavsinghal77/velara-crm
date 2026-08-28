import { Router } from 'express';
import {
  getUsers,
  createUser,
  updateUser,
  toggleUserActive,
} from '../controllers/user.controller';

const router = Router();

router.route('/').get(getUsers).post(createUser);
router.route('/:id').put(updateUser);
router.route('/:id/toggle-active').put(toggleUserActive);

export default router;
