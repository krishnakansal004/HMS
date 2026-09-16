import express from "express";
import { StaffController } from "../controllers/staffController.js";
import { inviteStaffValidator } from "../validators/staffValidator.js";
import { protect, requireRoles } from "../middlewares/authMiddleware.js";
import { requireTenant } from "../middlewares/tenantMiddleware.js";
import { enforcePlanLimitForRole, requirePlanFeature } from "../utils/saas.js";

const router = express.Router();

router.use(protect);
router.use(requireTenant);

// POST /api/staff/invite
// Who: Hospital Admin, Director
router.post(
  "/invite",
  requireRoles("HOSPITAL_ADMIN", "DIRECTOR"),
  requirePlanFeature("hrms"),
  enforcePlanLimitForRole("roleName"),
  inviteStaffValidator,
  StaffController.invite,
);

export default router;
