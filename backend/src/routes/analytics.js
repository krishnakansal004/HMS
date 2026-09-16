import express from "express";
import { AnalyticsController } from "../controllers/analyticsController.js";
import { protect, requireRoles } from "../middlewares/authMiddleware.js";
import { requireTenant } from "../middlewares/tenantMiddleware.js"; // Ensure this path is resolved!
import { requirePlanFeature } from "../utils/saas.js";

const router = express.Router();

router.use(protect);
router.use(requireTenant);

// GET /api/analytics/dashboard
// Who: Director, System Owner, Hospital Admin
router.get(
  "/dashboard",
  requireRoles("DIRECTOR", "SYSTEM_OWNER", "HOSPITAL_ADMIN"),
  requirePlanFeature("advanced_analytics"),
  AnalyticsController.getDashboardStats,
);

router.get(
  "/platform",
  requireRoles("SYSTEM_OWNER"),
  AnalyticsController.getPlatformStats);

export default router;
