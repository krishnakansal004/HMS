import express from "express";
import { DoctorManagementController } from "../controllers/doctorManagementController.js";
import {
  submitApplicationValidator,
  reviewApplicationValidator,
} from "../validators/doctorManagementValidator.js";
import { protect, requireRoles } from "../middlewares/authMiddleware.js";
import { requireTenant } from "../middlewares/tenantMiddleware.js";

const router = express.Router();

// POST /api/doctor-applications (Public pre-auth route)
router.post(
  "/",
  submitApplicationValidator,
  DoctorManagementController.submitApplication,
);

// PATCH /api/doctor-applications/:id/review (Protected admin route)
router.patch(
  "/:id/review",
  protect,
  requireTenant,
  requireRoles("HOSPITAL_ADMIN", "DIRECTOR"),
  reviewApplicationValidator,
  DoctorManagementController.reviewApplication,
);

// GET /api/doctor-applications (Protected admin route to list applications)
router.get(
  "/",
  protect,
  requireTenant,
  requireRoles("HOSPITAL_ADMIN", "DIRECTOR"),
  DoctorManagementController.list,
);

export default router;
