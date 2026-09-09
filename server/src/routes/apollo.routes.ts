import { Router } from 'express';
import {
  getApolloConfig,
  importApollo,
  searchApollo,
  testApollo,
  updateApolloConfig,
} from '../controllers/apollo.controller';
import { requireAdmin, requireWriter } from '../middlewares/auth';
import { writeLimiter } from '../middlewares/rateLimits';
import { validate } from '../middlewares/validate';
import { apolloImportSchema, apolloSearchSchema, updateApolloConfigSchema } from '../schemas';

const router = Router();

// The key decides what leaves and enters the workspace and bills against an
// external account, so configuring it is an admin decision.
router.get('/config', getApolloConfig);
router.put('/config', writeLimiter, requireAdmin, validate(updateApolloConfigSchema), updateApolloConfig);
router.post('/test', writeLimiter, requireAdmin, testApollo);

// Searching and importing is ordinary sales work, like adding a lead by hand.
router.post('/search', writeLimiter, requireWriter, validate(apolloSearchSchema), searchApollo);
router.post('/import', writeLimiter, requireWriter, validate(apolloImportSchema), importApollo);

export default router;
