import express from "express";
import { PaymentController } from "../controllers/paymentController.js";
import { initiatePaymentValidator, webhookValidator } from "../validators/paymentValidator.js";
import { protect, requireRoles } from "../middlewares/authMiddleware.js";
import { requireTenant } from "../middlewares/tenantMiddleware.js";

const router = express.Router();

// ------------------------------------------------------------------
// POST /api/payments/initiate
// Purpose: Create an order ID with Razorpay before checkout.
// Who: Patient paying their own bill, or front-desk staff.
// ------------------------------------------------------------------
router.post(
  "/initiate",
  protect,
  requireTenant,
  requireRoles("HOSPITAL_ADMIN", "RECEPTIONIST", "CASHIER", "PATIENT"),
  initiatePaymentValidator,
  PaymentController.initiatePayment
);

// ------------------------------------------------------------------
// POST /api/payments/webhook/verify
// Purpose: Authenticated frontend callback confirming the transaction is settled.
// HMAC plus tenant/user authorization are both required.
// ------------------------------------------------------------------
router.post(
  "/webhook/verify",
  protect,
  requireTenant,
  requireRoles("HOSPITAL_ADMIN", "RECEPTIONIST", "CASHIER", "PATIENT"),
  webhookValidator,
  PaymentController.handleWebhook
);

export default router;
