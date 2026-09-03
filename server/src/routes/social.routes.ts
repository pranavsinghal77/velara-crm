import { Router } from 'express';
import {
  cancelPost,
  createPost,
  disconnect,
  listConnections,
  listPosts,
  listProviders,
  publishPost,
  runDuePosts,
  setDefault,
  startConnect,
  verifyConnection,
} from '../controllers/social.controller';
import { requireAdmin, requireWriter } from '../middlewares/auth';
import { writeLimiter } from '../middlewares/rateLimits';
import { validate } from '../middlewares/validate';
import {
  createSocialPostSchema,
  idParam,
  platformParam,
  socialPostListQuery,
} from '../schemas';

const router = Router();

// Reading which channels exist and what is connected is useful to anyone who
// can compose a post.
router.get('/providers', listProviders);
router.get('/connections', listConnections);

// Connecting or removing an account changes who can publish as the business,
// so it is an admin decision.
router.post(
  '/connect/:platform',
  writeLimiter,
  requireAdmin,
  validate(platformParam, 'params'),
  startConnect
);
router.delete(
  '/connections/:id',
  writeLimiter,
  requireAdmin,
  validate(idParam, 'params'),
  disconnect
);
router.put(
  '/connections/:id/default',
  writeLimiter,
  requireAdmin,
  validate(idParam, 'params'),
  setDefault
);
router.post(
  '/connections/:id/verify',
  writeLimiter,
  requireAdmin,
  validate(idParam, 'params'),
  verifyConnection
);

// Composing and publishing is ordinary work.
router.get('/posts', validate(socialPostListQuery, 'query'), listPosts);
router.post('/posts', writeLimiter, requireWriter, validate(createSocialPostSchema), createPost);
router.post('/posts/run-due', writeLimiter, requireWriter, runDuePosts);
router.post(
  '/posts/:id/publish',
  writeLimiter,
  requireWriter,
  validate(idParam, 'params'),
  publishPost
);
router.delete('/posts/:id', writeLimiter, requireWriter, validate(idParam, 'params'), cancelPost);

export default router;
