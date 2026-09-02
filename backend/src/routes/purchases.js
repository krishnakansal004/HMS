import express from "express";
import { PurchaseController } from "../controllers/purchaseController.js";
import {
  createPurchaseValidator,
  updatePurchaseStatusValidator,
  listPurchasesValidator,
} from "../validators/purchaseValidator.js";
import { protect, requireRoles } from "../middlewares/authMiddleware.js";
import { requireTenant } from "../middlewares/tenantMiddleware.js";

const router = express.Router();

router.use(protect);
router.use(requireTenant);

// POST /api/purchases
// Who: Store Manager, Hospital Admin
router.post(
  "/",
  requireRoles("HOSPITAL_ADMIN", "STORE_MANAGER"),
  createPurchaseValidator,
  PurchaseController.create,
);

// GET /api/purchases
// Who: Hospital Admin, Store Manager, Accountant
router.get(
  "/",
  requireRoles("HOSPITAL_ADMIN", "STORE_MANAGER", "ACCOUNTANT"),
  listPurchasesValidator,
  PurchaseController.list,
);

// PATCH /api/purchases/:id/status
// Who: Store Manager, Hospital Admin
router.patch(
  "/:id/status",
  requireRoles("HOSPITAL_ADMIN", "STORE_MANAGER"),
  updatePurchaseStatusValidator,
  PurchaseController.updateStatus,
);

export default router;
