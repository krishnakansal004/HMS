import express from "express";
import { TenantPlanController } from "../controllers/tenantPlanController.js";
import { provisionTenantValidator } from "../validators/tenantPlanValidator.js";
// FIX: tenantProvisionLimiter existed in middlewares/rateLimiters.js but was
// never imported/applied here — this public onboarding endpoint (creates a
// full hospital tenant + admin user per call) had no rate limiting at all.
import { tenantProvisionLimiter } from "../middlewares/rateLimiters.js";

const router = express.Router();

// POST /api/tenants/provision (Public onboarding endpoint for new hospitals)
router.post(
  "/provision",
  tenantProvisionLimiter,
  provisionTenantValidator,
  TenantPlanController.provision,
);

export default router;
