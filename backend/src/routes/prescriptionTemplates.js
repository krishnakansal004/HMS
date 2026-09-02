import express from "express";
import { PrescriptionTemplateController } from "../controllers/prescriptionTemplateController.js";
import {
  createTemplateValidator,
  updateTemplateValidator,
  listTemplatesValidator,
  templateIdValidator,
} from "../validators/prescriptionTemplateValidator.js";
import { protect, requireRoles } from "../middlewares/authMiddleware.js";
import { requireTenant } from "../middlewares/tenantMiddleware.js";

const router = express.Router();

router.use(protect);
router.use(requireTenant);

// Doctors author templates; pharmacists/nurses only need to read them --
// matches the read/write role split already established on
// routes/prescriptions.js.
router.post(
  "/",
  requireRoles("DOCTOR"),
  createTemplateValidator,
  PrescriptionTemplateController.create,
);
router.get(
  "/",
  requireRoles("HOSPITAL_ADMIN", "DOCTOR", "PHARMACIST", "NURSE"),
  listTemplatesValidator,
  PrescriptionTemplateController.list,
);
router.get(
  "/:id",
  requireRoles("HOSPITAL_ADMIN", "DOCTOR", "PHARMACIST", "NURSE"),
  templateIdValidator,
  PrescriptionTemplateController.getById,
);
router.put(
  "/:id",
  requireRoles("DOCTOR"),
  updateTemplateValidator,
  PrescriptionTemplateController.update,
);
router.delete(
  "/:id",
  requireRoles("DOCTOR", "HOSPITAL_ADMIN"),
  templateIdValidator,
  PrescriptionTemplateController.remove,
);

export default router;
