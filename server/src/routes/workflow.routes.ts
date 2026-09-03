import { Router } from 'express';
import {
  createWorkflow,
  deleteWorkflow,
  getWorkflow,
  listRuns,
  listWorkflows,
  testWorkflow,
  toggleWorkflow,
  updateWorkflow,
} from '../controllers/workflow.controller';
import { requireManager } from '../middlewares/auth';
import { writeLimiter } from '../middlewares/rateLimits';
import { validate } from '../middlewares/validate';
import {
  createWorkflowSchema,
  idParam,
  testWorkflowSchema,
  updateWorkflowSchema,
} from '../schemas';

const router = Router();

// Reading automation is useful to anyone; authoring it changes behaviour for
// the whole workspace, so writes need a Manager seat.
router.get('/', listWorkflows);
router.get('/:id', validate(idParam, 'params'), getWorkflow);
router.get('/:id/runs', validate(idParam, 'params'), listRuns);

router.post('/', writeLimiter, requireManager, validate(createWorkflowSchema), createWorkflow);

router.post(
  '/:id/test',
  writeLimiter,
  requireManager,
  validate(idParam, 'params'),
  validate(testWorkflowSchema),
  testWorkflow
);

router.put(
  '/:id/toggle',
  writeLimiter,
  requireManager,
  validate(idParam, 'params'),
  toggleWorkflow
);

router.put(
  '/:id',
  writeLimiter,
  requireManager,
  validate(idParam, 'params'),
  validate(updateWorkflowSchema),
  updateWorkflow
);

router.delete(
  '/:id',
  writeLimiter,
  requireManager,
  validate(idParam, 'params'),
  deleteWorkflow
);

export default router;
