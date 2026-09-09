import { Router } from 'express';
import { handleCallback } from '../controllers/social.controller';
import { validate } from '../middlewares/validate';
import { platformParam } from '../schemas';

const router = Router();

/**
 * The OAuth return leg only.
 *
 * Mounted ahead of `requireAuth` because the provider sends the user's browser
 * here by top-level navigation, which carries no Authorization header. The
 * request is instead authenticated by the single-use `state` value issued when
 * the flow started, and it answers with a redirect back into the app.
 */
router.get('/callback/:platform', validate(platformParam, 'params'), handleCallback);

export default router;
