import { Router } from 'express';
import {
  getLeads,
  createLead,
  updateLead,
  deleteLead,
} from '../controllers/lead.controller';

const router = Router();

router.route('/').get(getLeads).post(createLead);
router.route('/:id').put(updateLead).delete(deleteLead);

export default router;
