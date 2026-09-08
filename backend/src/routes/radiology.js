import express from "express";
import { RadiologyController } from "../controllers/radiologyController.js";
import {
  orderRadiologyValidator,
  updateRadiologyValidator,
  listRadiologyOrdersValidator,
} from "../validators/radiologyValidator.js";
import { protect, requireRoles } from "../middlewares/authMiddleware.js";
import { requireTenant } from "../middlewares/tenantMiddleware.js";

const router = express.Router();

router.use(protect);
router.use(requireTenant);

// POST /api/radiology/orders
// Who: Doctors, Hospital Admins
router.post(
  "/orders",
  requireRoles("HOSPITAL_ADMIN", "DOCTOR"),
  orderRadiologyValidator,
  RadiologyController.order,
);

// PATCH /api/radiology/orders/:id/status
// Who: Radiology Technicians, Hospital Admins
router.patch(
  "/orders/:id/status",
  requireRoles("HOSPITAL_ADMIN", "RADIOLOGY_TECHNICIAN"),
  updateRadiologyValidator,
  RadiologyController.updateStatus,
);

// GET /api/radiology/orders
// Who: Hospital Admins, Doctors, Radiology Techs, Receptionists
router.get(
  "/orders",
  requireRoles( "HOSPITAL_ADMIN", "DOCTOR", "RADIOLOGY_TECHNICIAN", "RECEPTIONIST", "PATIENT"),
  listRadiologyOrdersValidator,
  RadiologyController.list,
);

export default router;
