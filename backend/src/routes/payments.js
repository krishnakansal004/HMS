import express from 'express';
import { PaymentController } from '../controllers/paymentController.js';
import { initiatePaymentValidator } from '../validators/paymentValidator.js';
import { protect, requireRoles } from '../middlewares/authMiddleware.js';
import { requireTenant } from '../middlewares/tenantMiddleware.js';

const router = express.Router();

// POST /api/payments/initiate
// Who: Hospital Admin, Accountant, Cashier
// Creates a Razorpay order for the outstanding balance of an invoice.
router.post(
    '/initiate',
    protect,
    requireTenant,
    requireRoles('HOSPITAL_ADMIN', 'ACCOUNTANT', 'CASHIER'),
    initiatePaymentValidator,
    PaymentController.initiatePayment);

// Public webhook endpoint for payment gateways (Razorpay/Stripe)
router.post(
    '/webhook/verify',
    PaymentController.handleWebhook);

export default router;