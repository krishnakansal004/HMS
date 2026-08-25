import express from "express";
import { DoctorAttendanceController } from "../controllers/doctorAttendanceController.js";
import {
  checkInOutValidator,
  setStatusValidator,
  listAttendanceValidator,
} from "../validators/doctorAttendanceValidator.js";
import { protect, requireRoles } from "../middlewares/authMiddleware.js";
import { requireTenant } from "../middlewares/tenantMiddleware.js";

const router = express.Router();

router.use(protect);
router.use(requireTenant);

// A doctor checks themselves in/out by default (targetUserId omitted).
// HOSPITAL_ADMIN/HR can act for another doctor -- enforced in the service,
// not the role gate here, since a DOCTOR legitimately needs this route for
// their own check-in.
router.post(
  "/check-in",
  requireRoles("DOCTOR", "HOSPITAL_ADMIN", "HR"),
  checkInOutValidator,
  DoctorAttendanceController.checkIn,
);
router.post(
  "/check-out",
  requireRoles("DOCTOR", "HOSPITAL_ADMIN", "HR"),
  checkInOutValidator,
  DoctorAttendanceController.checkOut,
);

// Marking a doctor absent/on_leave/half_day for a date is an admin action,
// not something a doctor does to themselves.
router.post(
  "/status",
  requireRoles("HOSPITAL_ADMIN", "HR"),
  setStatusValidator,
  DoctorAttendanceController.setStatus,
);

router.get(
  "/",
  requireRoles("HOSPITAL_ADMIN", "HR", "DIRECTOR", "DOCTOR"),
  listAttendanceValidator,
  DoctorAttendanceController.list,
);

export default router;
