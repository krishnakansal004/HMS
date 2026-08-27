import express from "express";
import { PrescriptionController } from "../controllers/prescriptionController.js";
import {
  createPrescriptionValidator,
  updateApprovalValidator,
  listPrescriptionsValidator,
} from "../validators/prescriptionValidator.js";
import { protect, requireRoles } from "../middlewares/authMiddleware.js";
import { requireTenant } from "../middlewares/tenantMiddleware.js";

const router = express.Router();

router.use(protect);
router.use(requireTenant);

// POST /api/prescriptions
// Who: Only Doctors
router.post(
  "/",
  requireRoles("DOCTOR"),
  createPrescriptionValidator,
  PrescriptionController.create,
);

// GET /api/prescriptions
// Who: Hospital Admin, Doctor, Pharmacist, Nurse
router.get(
  "/",
  requireRoles("HOSPITAL_ADMIN", "DOCTOR", "PHARMACIST", "NURSE", "PATIENT"),
  listPrescriptionsValidator,
  PrescriptionController.list,
);

// GET /api/prescriptions/:id
// Who: Hospital Admin, Doctor, Pharmacist, Nurse
router.get(
  "/:id",
  requireRoles("HOSPITAL_ADMIN", "DOCTOR", "PHARMACIST", "NURSE"),
  PrescriptionController.getById,
);

// PATCH /api/prescriptions/:id/approval
// Who: Hospital Admin only
router.patch(
  "/:id/approval",
  requireRoles("HOSPITAL_ADMIN"),
  updateApprovalValidator,
  PrescriptionController.updateApproval,
);

export default router;
