import express from 'express';
import { TenantPlanController } from '../controllers/tenantPlanController.js';
import { provisionTenantValidator } from '../validators/tenantPlanValidator.js';

const router = express.Router();

// POST /api/tenants/provision (Public onboarding endpoint for new hospitals)
router.post(
  '/provision',
  provisionTenantValidator,
  TenantPlanController.provision
);

export default router;