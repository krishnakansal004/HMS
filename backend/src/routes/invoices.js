import express from "express";
import { InvoiceController } from "../controllers/invoiceController.js";
import {
  generateInvoiceValidator,
  recordPaymentValidator,
  listInvoicesValidator,
} from "../validators/invoiceValidator.js";
import { protect, requireRoles } from "../middlewares/authMiddleware.js";
import { requireTenant } from "../middlewares/tenantMiddleware.js";

const router = express.Router();

// Enforce authentication and strict tenant boundaries on all routes
router.use(protect);
router.use(requireTenant);

// POST /api/invoices
// Who: Hospital Admin, Accountant, Cashier, Receptionist
router.post(
  "/",
  requireRoles("HOSPITAL_ADMIN", "ACCOUNTANT", "CASHIER", "RECEPTIONIST"),
  generateInvoiceValidator,
  InvoiceController.generate,
);

// POST /api/invoices/:id/pay
// Who: Hospital Admin, Accountant, Cashier
router.post(
  "/:id/pay",
  requireRoles("HOSPITAL_ADMIN", "ACCOUNTANT", "CASHIER"),
  recordPaymentValidator,
  InvoiceController.pay,
);

// GET /api/invoices
// Who: Hospital Admin, Accountant, Cashier, Receptionist, Doctor
router.get(
  "/",
  requireRoles(
    "HOSPITAL_ADMIN",
    "ACCOUNTANT",
    "CASHIER",
    "RECEPTIONIST",
    "DOCTOR",
    "PATIENT"
  ),
  listInvoicesValidator,
  InvoiceController.list,
);

export default router;
