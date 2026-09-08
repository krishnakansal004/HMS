import express from "express";
import { AvailabilityController } from "../controllers/availabilityController.js";
import {
  getAvailabilityValidator,
  updateAvailabilityValidator,
} from "../validators/availabilityValidator.js";
import { protect, requireRoles } from "../middlewares/authMiddleware.js";
import { requireTenant } from "../middlewares/tenantMiddleware.js";

const router = express.Router();

// Secure all availability routes
router.use(protect);
router.use(requireTenant);

// GET /api/availability/:doctorId
// Who: Admins, Doctors, Receptionists, Nurses, Patients
router.get(
  "/:doctorId",
  requireRoles( "HOSPITAL_ADMIN", "DIRECTOR", "DOCTOR", "RECEPTIONIST", "NURSE", "PATIENT",),
  getAvailabilityValidator,
  AvailabilityController.get,
);

// PUT /api/availability/:doctorId
// Who: Hospital Admin, Director, or the Doctor themselves
router.put(
  "/:doctorId",
  requireRoles("HOSPITAL_ADMIN", "DIRECTOR", "DOCTOR"),
  updateAvailabilityValidator,
  AvailabilityController.update,
);

export default router;
