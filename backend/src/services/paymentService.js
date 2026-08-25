import crypto from "crypto";
import Razorpay from "razorpay";
import { db, tenantStorage } from "../config/db.js";
import { AppError } from "../middlewares/errorHandler.js";
import { HTTP_STATUS } from "../constants/httpStatus.js";

export class PaymentService {
  // Initiation Flow
  static async createPaymentOrder({ tenantId, invoiceId, amount }) {
    const invoice = await db.invoice.findFirst({
      where: { invoice_id: invoiceId, tenant_id: tenantId },
    });
    if (!invoice)
      throw new AppError("Invoice not found.", HTTP_STATUS.NOT_FOUND);

    const rzp = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_SECRET,
    });

    // Razorpay expects amount in minor currency (paise)
    const options = {
      amount: Math.round(Number(amount)),
      currency: "INR",
      receipt: invoiceId,
    };

    const order = await rzp.orders.create(options);
    return order;
  }

  // Real Signature Verification
  static async verifyPaymentWebhook({
    invoiceId,
    gatewayPaymentId,
    razorpayOrderId,
    amountPaid,
    signature,
  }) {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

    // HMAC SHA256 Verification
    const generatedSignature = crypto
      .createHmac("sha256", secret)
      .update(razorpayOrderId + "|" + gatewayPaymentId)
      .digest("hex");

    if (generatedSignature !== signature) {
      throw new AppError(
        "Cryptographic signature verification failed. Possible fraud attempt.",
        HTTP_STATUS.UNAUTHORIZED,
      );
    }

    const invoice = await db.invoice.findUnique({
      where: { invoice_id: invoiceId },
    });
    if (!invoice)
      throw new AppError(
        "Invoice not found for webhook.",
        HTTP_STATUS.NOT_FOUND,
      );

    return tenantStorage.run({ tenantId: invoice.tenant_id }, async () => {
      return db.$transaction(async (tx) => {
        const payment = await tx.payment.create({
          data: {
            tenant_id: invoice.tenant_id,
            invoice_id: invoiceId,
            amount: Number(amountPaid),
            method: "ONLINE_GATEWAY",
            transaction_id: gatewayPaymentId,
            status: "SUCCESS",
          },
        });

        const newAmountPaid = Number(invoice.amount_paid) + Number(amountPaid);
        const newStatus =
          newAmountPaid >= Number(invoice.total) ? "paid" : "partial";

        await tx.invoice.update({
          where: { invoice_id: invoiceId },
          data: { amount_paid: newAmountPaid, status: newStatus },
        });

        return payment;
      });
    });
  }
}
