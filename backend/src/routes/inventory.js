import express from "express";
import { InventoryController } from "../controllers/inventoryController.js";
import {
  createMedicineValidator,
  dispenseValidator,
  receivePurchaseValidator,
  listMedicinesValidator,
} from "../validators/inventoryValidator.js";
import { protect, requireRoles } from "../middlewares/authMiddleware.js";
import { requireTenant } from "../middlewares/tenantMiddleware.js";

const router = express.Router();

// Secure all inventory routes
router.use(protect);
router.use(requireTenant);

// POST /api/inventory/medicines
// Who: Hospital Admin, Pharmacist, Store Manager
router.post(
  "/medicines",
  requireRoles("HOSPITAL_ADMIN", "PHARMACIST", "STORE_MANAGER"),
  createMedicineValidator,
  InventoryController.add,
);

// GET /api/inventory/medicines
// Who: Doctors can view available stock, Admins/Pharmacists can view all
router.get(
  "/medicines",
  requireRoles( "HOSPITAL_ADMIN", "PHARMACIST", "STORE_MANAGER", "DOCTOR", "NURSE",),
  listMedicinesValidator,
  InventoryController.list,
);

// POST /api/inventory/medicines/:id/dispense
// Who: Pharmacist (fulfilling prescription), Nurse (ward dispense)
router.post(
  "/medicines/:id/dispense",
  requireRoles("HOSPITAL_ADMIN", "PHARMACIST", "NURSE"),
  dispenseValidator,
  InventoryController.dispense,
);

// POST /api/inventory/medicines/:id/receive
// Who: Store Manager, Admin
router.post(
  "/medicines/:id/receive",
  requireRoles("HOSPITAL_ADMIN", "STORE_MANAGER", "PHARMACIST"),
  receivePurchaseValidator,
  InventoryController.receive,
);

export default router;
