import { Router } from 'express';
import {
  chat,
  escalate,
  getAiStatus,
  knowledgeQuery,
  sentimentAnalysis,
  smartReply,
  visualCompliance,
} from '../controllers/ai.controller';
import { aiLimiter } from '../middlewares/rateLimits';
import { validate } from '../middlewares/validate';
import {
  aiChatSchema,
  escalateSchema,
  knowledgeQuerySchema,
  sentimentSchema,
  smartReplySchema,
  visualComplianceSchema,
} from '../schemas';

const router = Router();

// Cheap, so it sits outside the meter: the UI calls it to decide whether to
// show AI affordances at all.
router.get('/status', getAiStatus);

// Everything past here costs money per call, so it is metered per user.
// Authentication is applied to the whole /api tree in routes/index.ts, so none
// of these are reachable anonymously.
router.use(aiLimiter);

router.post('/smart-reply', validate(smartReplySchema), smartReply);
router.post('/sentiment-analysis', validate(sentimentSchema), sentimentAnalysis);
router.post('/escalate', validate(escalateSchema), escalate);
router.post('/knowledge-query', validate(knowledgeQuerySchema), knowledgeQuery);
router.post('/visual-compliance', validate(visualComplianceSchema), visualCompliance);
router.post('/chat', validate(aiChatSchema), chat);

export default router;
