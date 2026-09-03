import { Router } from 'express';
import { handleMcp } from '../controllers/mcp.controller';
import { authenticateApiKey } from '../middlewares/apiKey';
import { aiLimiter } from '../middlewares/rateLimits';

const router = Router();

/**
 * The MCP endpoint is mounted outside the session-authenticated tree because
 * its callers are machines holding an API key, not browsers holding a cookie.
 * `authenticateApiKey` fills in the same request context session auth would, so
 * the tool implementations are identical either way.
 */
router.use(authenticateApiKey);
router.use(aiLimiter);

router.post('/', handleMcp);

// A GET makes the endpoint self-describing for anyone who opens it in a
// browser while wiring up a client.
router.get('/', (_req, res) => {
  res.json({
    name: 'velara-crm',
    protocol: 'mcp',
    protocolVersion: '2024-11-05',
    transport: 'streamable-http (JSON-RPC 2.0 over POST)',
    authentication: 'X-API-Key, or Authorization: Bearer <api key>',
    hint: 'POST {"jsonrpc":"2.0","id":1,"method":"tools/list"} to enumerate tools.',
  });
});

export default router;
