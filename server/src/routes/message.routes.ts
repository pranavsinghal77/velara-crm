import { Router } from 'express';
import {
  getMessages,
  createMessage,
  markMessageRead,
} from '../controllers/message.controller';

const router = Router();

router.route('/').get(getMessages).post(createMessage);
router.route('/:id/read').put(markMessageRead);

export default router;
