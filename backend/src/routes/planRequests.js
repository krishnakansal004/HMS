import express from 'express';
import { TenantPlanController } from '../controllers/tenantPlanController.js';
import { requestPlanValidator, reviewPlanRequestValidator } from '../validators/tenantPlanValidator.js';
import { protect, requireRoles } from '../middlewares/authMiddleware.js';
import { requireTenant } from '../middlewares/tenantMiddleware.js';

const router = express.Router();

// POST /api/plan-requests (Tenant Admin requesting an upgrade/renewal)
router.post(
  '/',
  protect,
  requireTenant,
  requireRoles('HOSPITAL_ADMIN'),
  requestPlanValidator,
  TenantPlanController.requestPlan
);

// GET /api/plan-requests (System Owner / Director viewing pending requests)
router.get(
  '/',
  protect,
  requireRoles('SYSTEM_OWNER', 'DIRECTOR'),
  TenantPlanController.listRequests
);

// PATCH /api/plan-requests/:id/review (System Owner / Director approving/rejecting)
router.patch(
  '/:id/review',
  protect,
  requireRoles('SYSTEM_OWNER', 'DIRECTOR'),
  reviewPlanRequestValidator,
  TenantPlanController.reviewRequest
);

export default router;