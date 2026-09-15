import { PaymentService } from "../services/paymentService.js";
import { HTTP_STATUS } from "../constants/httpStatus.js";

export class PaymentController {
  static async initiatePayment(req, res, next) {
    try {
      const { invoiceId } = req.body;

      const order = await PaymentService.createPaymentOrder({
        tenantId: req.currentTenantId,
        invoiceId,
        userId: req.userId,
        userRole: req.userRole,
      });

      res.status(HTTP_STATUS.CREATED).json({ success: true, data: order });
    } catch (error) {
      next(error);
    }
  }

  // Processes the success callback from the frontend Razorpay checkout
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
        tenantId: req.currentTenantId,
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