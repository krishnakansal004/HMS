import express from "express";
import { TenantPlanController } from "../controllers/tenantPlanController.js";
import { createPlanValidator } from "../validators/tenantPlanValidator.js";
import { protect, requireRoles } from "../middlewares/authMiddleware.js";

const router = express.Router();

// GET /api/plans/public (Public pricing catalog for hospital onboarding)
router.get("/public", TenantPlanController.listPublicPlans);

// GET /api/plans (System Owner / Director catalog)
router.get("/", protect, requireRoles("SYSTEM_OWNER", "DIRECTOR"), TenantPlanController.listPlans);

// POST /api/plans (System Owner / Director only)
router.post(
  "/",
  protect,
  requireRoles("SYSTEM_OWNER", "DIRECTOR"),
  createPlanValidator,
  TenantPlanController.createPlan,
);

export default router;
