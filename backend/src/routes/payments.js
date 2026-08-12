import express from 'express';
import { PaymentController } from '../controllers/paymentController.js';

const router = express.Router();
// Public webhook endpoint for payment gateways (Razorpay/Stripe)
router.post('/webhook/verify', PaymentController.handleWebhook);
export default router;