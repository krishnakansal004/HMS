import express from "express";
import { AttendanceController } from "../controllers/attendanceController.js";
import {
  checkInOutValidator,
  listAttendanceValidator,
} from "../validators/attendanceValidator.js";
import { protect, requireRoles } from "../middlewares/authMiddleware.js";
import { requireTenant } from "../middlewares/tenantMiddleware.js";

const router = express.Router();

// All routes require valid JWT and Tenant context
router.use(protect);
router.use(requireTenant);

// POST /api/attendance/check-in
// Who: Any hospital staff member marking their own attendance, or HR marking for someone else.
router.post(
  "/check-in",
  requireRoles( "HOSPITAL_ADMIN", "HR", "DOCTOR", "NURSE", "RECEPTIONIST", "PHARMACIST", "LAB_TECHNICIAN",
  ),
  checkInOutValidator,
  AttendanceController.checkIn,
);

// POST /api/attendance/check-out
// Who: Any hospital staff member ending their shift.
router.post(
  "/check-out",
  requireRoles( "HOSPITAL_ADMIN", "HR", "DOCTOR", "NURSE", "RECEPTIONIST", "PHARMACIST", "LAB_TECHNICIAN",),
  checkInOutValidator,
  AttendanceController.checkOut,
);

// GET /api/attendance
// Who: Everyone can view. Service layer handles scoping (Staff see own, HR sees all).
router.get(
  "/",
  requireRoles("HOSPITAL_ADMIN","HR", "DOCTOR", "NURSE", "RECEPTIONIST", "PHARMACIST", "LAB_TECHNICIAN",),
  listAttendanceValidator,
  AttendanceController.list,
);

export default router;
