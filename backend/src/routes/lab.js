import express from "express";
import { LabController } from "../controllers/labController.js";
import {
  createTestCatalogValidator,
  orderLabValidator,
  updateLabResultsValidator,
  listLabOrdersValidator,
} from "../validators/labValidator.js";
import { protect, requireRoles } from "../middlewares/authMiddleware.js";
import { requireTenant } from "../middlewares/tenantMiddleware.js";

const router = express.Router();

router.use(protect);
router.use(requireTenant);

// POST /api/lab/catalog
// Who: Hospital Admin, Pathologist
router.post(
  "/catalog",
  requireRoles("HOSPITAL_ADMIN", "LAB_TECHNICIAN"),
  createTestCatalogValidator,
  LabController.createCatalogItem,
);

// POST /api/lab/orders
// Who: Doctor, Hospital Admin
router.post(
  "/orders",
  requireRoles("HOSPITAL_ADMIN", "DOCTOR"),
  orderLabValidator,
  LabController.order,
);

// PATCH /api/lab/orders/:id/results
// Who: Lab Technician, Hospital Admin
router.patch(
  "/orders/:id/results",
  requireRoles("HOSPITAL_ADMIN", "LAB_TECHNICIAN"),
  updateLabResultsValidator,
  LabController.updateResults,
);

// GET /api/lab/orders
// Who: Doctors, Lab Techs, Admins, Patients (Patient access filtering can be layered if needed)
router.get(
  "/orders",
  requireRoles("HOSPITAL_ADMIN", "DOCTOR", "LAB_TECHNICIAN", "RECEPTIONIST"),
  listLabOrdersValidator,
  LabController.list,
);

export default router;
