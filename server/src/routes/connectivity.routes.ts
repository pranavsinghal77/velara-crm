import { Router } from 'express';
import {
  createApiKey,
  createMcpConnection,
  createWebhook,
  deleteMcpConnection,
  deleteWebhook,
  getAiConfig,
  getConnectivityOverview,
  listApiKeys,
  listMcpConnections,
  listWebhooks,
  revokeApiKey,
  testMcpConnection,
  updateAiConfig,
  updateMcpConnection,
  updateWebhook,
} from '../controllers/connectivity.controller';
import { requireAdmin } from '../middlewares/auth';
import { writeLimiter } from '../middlewares/rateLimits';
import { validate } from '../middlewares/validate';
import {
  createApiKeySchema,
  createMcpSchema,
  createWebhookSchema,
  idParam,
  updateAiConfigSchema,
  updateMcpSchema,
  updateWebhookSchema,
} from '../schemas';

const router = Router();

// These settings decide what leaves the workspace: who holds a machine
// credential, which external servers we talk to, whose AI key pays. Admin only.
router.use(requireAdmin);

router.get('/overview', getConnectivityOverview);

// API keys
router.get('/api-keys', listApiKeys);
router.post('/api-keys', writeLimiter, validate(createApiKeySchema), createApiKey);
router.delete('/api-keys/:id', writeLimiter, validate(idParam, 'params'), revokeApiKey);

// MCP connections
router.get('/mcp', listMcpConnections);
router.post('/mcp', writeLimiter, validate(createMcpSchema), createMcpConnection);
router.post('/mcp/:id/test', writeLimiter, validate(idParam, 'params'), testMcpConnection);
router.put(
  '/mcp/:id',
  writeLimiter,
  validate(idParam, 'params'),
  validate(updateMcpSchema),
  updateMcpConnection
);
router.delete('/mcp/:id', writeLimiter, validate(idParam, 'params'), deleteMcpConnection);

// AI provider
router.get('/ai', getAiConfig);
router.put('/ai', writeLimiter, validate(updateAiConfigSchema), updateAiConfig);

// Outbound webhooks
router.get('/webhooks', listWebhooks);
router.post('/webhooks', writeLimiter, validate(createWebhookSchema), createWebhook);
router.put(
  '/webhooks/:id',
  writeLimiter,
  validate(idParam, 'params'),
  validate(updateWebhookSchema),
  updateWebhook
);
router.delete('/webhooks/:id', writeLimiter, validate(idParam, 'params'), deleteWebhook);

export default router;
