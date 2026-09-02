import express from "express";
import { AppointmentController } from "../controllers/appointmentController.js";
import {
  bookAppointmentValidator,
  updateStatusValidator,
  listAppointmentsValidator,
} from "../validators/appointmentValidator.js";
import { protect, requireRoles } from "../middlewares/authMiddleware.js";
import { requireTenant } from "../middlewares/tenantMiddleware.js";

const router = express.Router();

// All routes require a valid JWT and a validated Tenant context
router.use(protect);
router.use(requireTenant);

// POST /api/appointments
// Who: Receptionist, Hospital Admin, Patient (Booking for themselves)
router.post(
  "/",
  requireRoles("HOSPITAL_ADMIN", "RECEPTIONIST", "PATIENT", "DOCTOR"),
  bookAppointmentValidator,
  AppointmentController.book,
);

// GET /api/appointments
// Who: Doctors, Receptionist, Admin (Patients can query their own via patientId filter enforced at service layer later)
router.get("/", listAppointmentsValidator, AppointmentController.list);

// PATCH /api/appointments/:id/status
// Who: Doctor (Completing/In-Progress), Receptionist (Check-in, Cancellation)
router.patch(
  "/:id/status",
  requireRoles("HOSPITAL_ADMIN", "RECEPTIONIST", "DOCTOR"),
  updateStatusValidator,
  AppointmentController.updateStatus,
);

export default router;
