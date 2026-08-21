import express from 'express';
import { PaymentController } from '../controllers/paymentController.js';
// Payment Controller will be create in PHASE - 4 only route initialised 
const router = express.Router();
// Public webhook endpoint for payment gateways (Razorpay/Stripe)
router.post(
    '/webhook/verify',
    PaymentController.handleWebhook);
export default router;