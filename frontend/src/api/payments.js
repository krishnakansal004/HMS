import { api } from './client.js';

// Maps to backend/src/routes/payments.js + paymentValidator.js

export const paymentsApi = {
  /**
   * Initiates a Razorpay order. The backend strictly calculates the pending amount.
   * @param {{invoiceId: string}} data 
   */
  initiate: (data) => api.post('/payments/initiate', data),

  /**
   * Synchronous frontend callback to verify the Razorpay cryptographic signature 
   * and record the payment in the database.
   * @param {{
   *   invoiceId: string, 
   *   gatewayPaymentId: string, 
   *   razorpayOrderId: string, 
   *   amountPaid: number, 
   *   signature: string
   * }} data 
   */
  verifyWebhook: (data) => api.post('/payments/webhook/verify', data),
};
