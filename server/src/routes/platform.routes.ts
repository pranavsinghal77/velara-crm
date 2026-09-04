import { Router } from 'express';
import {
  closeTenantPeriod,
  getOverview,
  getTenant,
  linkStripeCustomer,
  listDuePeriods,
  listPlans,
  listTenants,
  rebuildTenantCounters,
  updateSubscription,
} from '../controllers/platform.controller';
import { requirePlatformAdmin } from '../middlewares/platformAdmin';
import { writeLimiter } from '../middlewares/rateLimits';
import { validate } from '../middlewares/validate';
import {
  closePeriodSchema,
  idParam,
  tenantListQuery,
  updateSubscriptionSchema,
} from '../schemas';

const router = Router();

// Cross-tenant by design. `requireAuth` already ran in routes/index.ts; this
// adds the platform-operator check on top of it for the whole subtree, so a
// route added below cannot accidentally be reachable by a tenant user.
router.use(requirePlatformAdmin);

router.get('/overview', getOverview);
router.get('/plans', listPlans);
router.get('/billing-runs/due', listDuePeriods);

router.get('/tenants', validate(tenantListQuery, 'query'), listTenants);
router.get('/tenants/:id', validate(idParam, 'params'), getTenant);

router.put(
  '/tenants/:id/subscription',
  writeLimiter,
  validate(idParam, 'params'),
  validate(updateSubscriptionSchema),
  updateSubscription
);

router.post(
  '/tenants/:id/stripe-customer',
  writeLimiter,
  validate(idParam, 'params'),
  linkStripeCustomer
);

router.post(
  '/tenants/:id/close-period',
  writeLimiter,
  validate(idParam, 'params'),
  validate(closePeriodSchema),
  closeTenantPeriod
);

router.post(
  '/tenants/:id/rebuild-counters',
  writeLimiter,
  validate(idParam, 'params'),
  rebuildTenantCounters
);

export default router;
