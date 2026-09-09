import { Router } from 'express';
import {
  createMessage,
  getMessages,
  markAllMessagesRead,
  markMessageRead,
} from '../controllers/message.controller';
import { requireWriter } from '../middlewares/auth';
import { writeLimiter } from '../middlewares/rateLimits';
import { validate } from '../middlewares/validate';
import { createMessageSchema, idParam, messageListQuery } from '../schemas';

const router = Router();

router.get('/', validate(messageListQuery, 'query'), getMessages);

router.post('/', writeLimiter, requireWriter, validate(createMessageSchema), createMessage);

// Declared before the parameterised route so "read-all" is not captured as an id.
router.put('/read-all', writeLimiter, markAllMessagesRead);
router.put('/:id/read', writeLimiter, validate(idParam, 'params'), markMessageRead);

export default router;
