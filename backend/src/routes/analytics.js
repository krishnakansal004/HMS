import express from "express";
import { AnalyticsController } from "../controllers/analyticsController.js";
import { protect, requireRoles } from "../middlewares/authMiddleware.js";
import { requireTenant } from "../middlewares/tenantMiddleware.js"; // Ensure this path is resolved!

const router = express.Router();

router.use(protect);
router.use(requireTenant);

// GET /api/analytics/dashboard
// Who: Director, System Owner, Hospital Admin
router.get(
  "/dashboard",
  requireRoles("DIRECTOR", "SYSTEM_OWNER", "HOSPITAL_ADMIN"),
  AnalyticsController.getDashboardStats,
);

router.get(
  "/platform",
  requireRoles("SYSTEM_OWNER", "DIRECTOR"), 
  AnalyticsController.getPlatformStats);

export default router;
