import express from "express";
import { PaymentController } from "../controllers/paymentController.js";
import { webhookValidator } from "../validators/paymentValidator.js";
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
  // TODO: Add initiatePaymentValidator here (requires: invoiceId, amount)
  PaymentController.initiatePayment,
);

// ------------------------------------------------------------------
// POST /api/payments/webhook/verify
// Purpose: Gateway callback confirming the transaction is settled.
// Who: Public (Razorpay Servers). Authenticated via HMAC signature.
// ------------------------------------------------------------------
router.post(
  "/webhook/verify",
  webhookValidator,
  PaymentController.handleWebhook,
);

export default router;
