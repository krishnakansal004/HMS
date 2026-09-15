import express from "express";
import { TenantPlanController } from "../controllers/tenantPlanController.js";
import { createPlanValidator } from "../validators/tenantPlanValidator.js";
import { protect, requireRoles } from "../middlewares/authMiddleware.js";

const router = express.Router();

// GET /api/plans/public (Public pricing catalog for hospital onboarding)
router.get("/public", TenantPlanController.listPublicPlans);

// GET /api/plans (System Owner platform catalog)
router.get("/", protect, requireRoles("SYSTEM_OWNER"), TenantPlanController.listPlans);

// POST /api/plans (System Owner only)
router.post(
  "/",
  protect,
  requireRoles("SYSTEM_OWNER"),
  createPlanValidator,
  TenantPlanController.createPlan,
);

export default router;
