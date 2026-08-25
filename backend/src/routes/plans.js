import express from "express";
import { TenantPlanController } from "../controllers/tenantPlanController.js";
import { createPlanValidator } from "../validators/tenantPlanValidator.js";
import { protect, requireRoles } from "../middlewares/authMiddleware.js";

const router = express.Router();

// GET /api/plans (Public - so hospitals can view available pricing plans)
router.get("/", TenantPlanController.listPlans);

// POST /api/plans (System Owner / Director only)
router.post(
  "/",
  protect,
  requireRoles("SYSTEM_OWNER", "DIRECTOR"),
  createPlanValidator,
  TenantPlanController.createPlan,
);

export default router;
