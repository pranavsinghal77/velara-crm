import { Router } from 'express';
import {
  createLead,
  deleteLead,
  getLead,
  getLeads,
  updateLead,
} from '../controllers/lead.controller';
import { requireManager, requireWriter } from '../middlewares/auth';
import { writeLimiter } from '../middlewares/rateLimits';
import { validate } from '../middlewares/validate';
import { createLeadSchema, idParam, leadListQuery, updateLeadSchema } from '../schemas';

const router = Router();

router.get('/', validate(leadListQuery, 'query'), getLeads);
router.get('/:id', validate(idParam, 'params'), getLead);

router.post('/', writeLimiter, requireWriter, validate(createLeadSchema), createLead);

router.put(
  '/:id',
  writeLimiter,
  requireWriter,
  validate(idParam, 'params'),
  validate(updateLeadSchema),
  updateLead
);

// Deleting a lead destroys its message history, so it needs more than a
// Sales seat.
router.delete(
  '/:id',
  writeLimiter,
  requireManager,
  validate(idParam, 'params'),
  deleteLead
);

export default router;
