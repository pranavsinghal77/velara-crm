import { Router } from 'express';
import { seedDatabase } from '../controllers/seed.controller';

const router = Router();

router.get('/', seedDatabase);
router.post('/', seedDatabase);

export default router;
