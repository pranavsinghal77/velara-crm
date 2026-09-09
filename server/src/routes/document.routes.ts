import { Router } from 'express';
import {
  createDocument,
  deleteDocument,
  getDocumentContent,
  listDocuments,
  updateDocument,
} from '../controllers/document.controller';
import { requireManager, requireWriter } from '../middlewares/auth';
import { writeLimiter } from '../middlewares/rateLimits';
import { validate } from '../middlewares/validate';
import {
  createDocumentSchema,
  documentListQuery,
  idParam,
  updateDocumentSchema,
} from '../schemas';

const router = Router();

router.get('/', validate(documentListQuery, 'query'), listDocuments);
router.get('/:id/content', validate(idParam, 'params'), getDocumentContent);

router.post('/', writeLimiter, requireWriter, validate(createDocumentSchema), createDocument);

router.put(
  '/:id',
  writeLimiter,
  requireWriter,
  validate(idParam, 'params'),
  validate(updateDocumentSchema),
  updateDocument
);

// Deleting the only copy of a contract is not a Sales-seat action.
router.delete(
  '/:id',
  writeLimiter,
  requireManager,
  validate(idParam, 'params'),
  deleteDocument
);

export default router;
