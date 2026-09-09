import { Router } from 'express';
import { handleCallback } from '../controllers/microsoft.controller';

const router = Router();

/**
 * The Microsoft OAuth return leg only.
 *
 * Mounted ahead of `requireAuth` because Microsoft sends the user's browser
 * here by top-level navigation, carrying no Authorization header. The request
 * is authenticated instead by the single-use `state` issued when the flow
 * began, and it answers with a redirect back into the app.
 */
router.get('/callback', handleCallback);

export default router;
