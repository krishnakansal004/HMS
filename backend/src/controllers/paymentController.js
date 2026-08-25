import { PaymentService } from "../services/paymentService.js";
import { HTTP_STATUS } from "../constants/httpStatus.js";

export class PaymentController {
  // Secure payment initiation
  static async initiatePayment(req, res, next) {
    try {
      const { invoiceId, amount } = req.body;

      const order = await PaymentService.createPaymentOrder({
        tenantId: req.currentTenantId, // Extracted securely from the tenant middleware
        invoiceId,
        amount,
      });

      res.status(HTTP_STATUS.CREATED).json({ success: true, data: order });
    } catch (error) {
      next(error);
    }
  }

  // Public webhook handling
  // No `protect` or `requireTenant` -- gateways cannot authenticate as users.
  static async handleWebhook(req, res, next) {
    try {
      const {
        invoiceId,
        gatewayPaymentId,
        razorpayOrderId,
        amountPaid,
        signature,
      } = req.body;

      const payment = await PaymentService.verifyPaymentWebhook({
        invoiceId,
        gatewayPaymentId,
        razorpayOrderId,
        amountPaid,
        signature,
      });

      res.status(HTTP_STATUS.OK).json({ success: true, data: payment });
    } catch (error) {
      next(error);
    }
  }
}
