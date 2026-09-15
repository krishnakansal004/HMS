import express from "express";
import { TenantPlanController } from "../controllers/tenantPlanController.js";
import { provisionTenantValidator, verifyProvisionPaymentValidator, updateTenantStatusValidator, updateTenantPlanValidator } from "../validators/tenantPlanValidator.js";
import { protect, requireRoles } from '../middlewares/authMiddleware.js';
import { tenantProvisionLimiter } from "../middlewares/rateLimiters.js";
const router = express.Router();

// POST /api/tenants/provision (Public onboarding endpoint for new hospitals)
router.post(
  "/provision",
  tenantProvisionLimiter,
  provisionTenantValidator,
  TenantPlanController.provisionPublic,
);

// Paid public signup confirmation. The server verifies both the Razorpay
// Checkout signature and the captured payment amount/order before provisioning.
router.post(
  "/provision/verify-payment",
  tenantProvisionLimiter,
  verifyProvisionPaymentValidator,
  TenantPlanController.verifyPublicProvisionPayment,
);

// Razorpay server-to-server confirmation. app.js captures rawBody before JSON parsing.
router.post(
  "/provision/webhook",
  TenantPlanController.provisionWebhook,
);

// Internal provisioning remains available to the system owner/director and
// does not use the public payment flow.
router.post(
  "/admin-provision",
  protect,
  requireRoles("SYSTEM_OWNER", "DIRECTOR"),
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

router.patch(
  '/:id/status', 
  protect, 
  requireRoles('SYSTEM_OWNER', 'DIRECTOR'), 
  updateTenantStatusValidator,
  TenantPlanController.updateStatus
);

router.patch(
  '/:id/plan', 
  protect, 
  requireRoles('SYSTEM_OWNER', 'DIRECTOR'), 
  updateTenantPlanValidator,
  TenantPlanController.updatePlan
);
export default router;
