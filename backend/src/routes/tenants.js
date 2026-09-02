import express from "express";
import { TenantPlanController } from "../controllers/tenantPlanController.js";
import { provisionTenantValidator } from "../validators/tenantPlanValidator.js";
import { protect, requireRoles } from '../middlewares/authMiddleware.js';
import { tenantProvisionLimiter } from "../middlewares/rateLimiters.js";

const router = express.Router();

// POST /api/tenants/provision (Public onboarding endpoint for new hospitals)
router.post(
  "/provision",
  tenantProvisionLimiter,
  provisionTenantValidator,
  TenantPlanController.provision,
);

// GET /api/tenants (System Owner / Director viewing all hospitals)
router.get(
  '/',
  protect,
  requireRoles('SYSTEM_OWNER', 'DIRECTOR'),
  TenantPlanController.listTenants
);

// GET /api/tenants/:id (System Owner / Director viewing specific hospital)
router.get(
  '/:id',
  protect,
  requireRoles('SYSTEM_OWNER', 'DIRECTOR'),
  TenantPlanController.getTenant
);
export default router;
