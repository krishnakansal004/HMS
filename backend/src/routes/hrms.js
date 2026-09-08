import express from "express";
import { HrmsController } from "../controllers/hrmsController.js";
import { protect, requireRoles } from "../middlewares/authMiddleware.js";
import { requireTenant } from "../middlewares/tenantMiddleware.js";
import {
  applyLeaveValidator,
  reviewLeaveValidator,
  createShiftValidator,
  listStaffValidator,
} from "../validators/hrmsValidator.js";

const router = express.Router();

router.use(protect);
router.use(requireTenant);

// Any authenticated staff member can apply for their own leave.
// HOSPITAL_ADMIN/HR can apply on someone else's behalf (enforced in the
// controller, not here -- targetUserId is silently ignored for anyone
// else, not rejected, since sending it is harmless for a normal staff
// member applying for themselves).
router.post(
  "/leaves", 
  applyLeaveValidator, 
  HrmsController.applyLeave);

router.patch(
  "/leaves/:id/review",
  requireRoles("HOSPITAL_ADMIN", "HR"),
  reviewLeaveValidator,
  HrmsController.reviewLeave,
);

router.post(
  "/shifts",
  requireRoles("HOSPITAL_ADMIN", "HR"),
  createShiftValidator,
  HrmsController.createShift,
);

router.get(
  "/staff",
  requireRoles("HOSPITAL_ADMIN", "HR", "DIRECTOR"),
  listStaffValidator,
  HrmsController.listStaff,
);

router.get(
  "/leaves",
  requireRoles("HOSPITAL_ADMIN", "HR", "DIRECTOR"),
  HrmsController.listLeaves
);

export default router;
