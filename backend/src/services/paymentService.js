import crypto from "crypto";
import { db, tenantStorage } from "../config/db.js";
import { razorpay } from "../config/razorpay.js";
import { AppError } from "../middlewares/errorHandler.js";
import { HTTP_STATUS } from "../constants/httpStatus.js";

export class PaymentService {
  // Initiation Flow
  static async createPaymentOrder({ tenantId, invoiceId }) {
    // Fetch invoice and patient details for UI prefill
    const invoice = await db.invoice.findFirst({
      where: { invoice_id: invoiceId, tenant_id: tenantId },
      include: { patient: { select: { first_name: true, last_name: true, email: true, phone: true } } }
    });
    
    if (!invoice) throw new AppError("Invoice not found.", HTTP_STATUS.NOT_FOUND);
    if (invoice.status === "paid") throw new AppError("Invoice is already paid.", HTTP_STATUS.BAD_REQUEST);

    // SECURITY FIX: Backend calculates exact pending amount, never trust the frontend.
    // invoice.total / amount_paid are already stored in minor currency units
    // (paise) throughout this app — see invoiceValidator.js and GenerateInvoicePage.jsx,
    // which multiply rupee input by 100 before it's ever persisted. Razorpay's
    // `amount` also wants paise, so this needs no further conversion.
    const pendingAmountPaise = Number(invoice.total) - Number(invoice.amount_paid);

    if (pendingAmountPaise <= 0) throw new AppError("No pending balance.", HTTP_STATUS.BAD_REQUEST);

    const options = {
      amount: pendingAmountPaise,
      currency: "INR",
      receipt: invoiceId.slice(0, 40),
    };

    const order = await razorpay.orders.create(options);

    return {
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
      patient: {
        name: `${invoice.patient.first_name} ${invoice.patient.last_name || ''}`.trim(),
        email: invoice.patient.email || '',
        contact: invoice.patient.phone || ''
      }
    };
  }

  // Real Signature Verification (Synchronous Frontend Callback)
  static async verifyPaymentWebhook({ invoiceId, gatewayPaymentId, razorpayOrderId, amountPaid, signature }) {
    const secret = process.env.RAZORPAY_KEY_SECRET;

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
    
    if (!invoice) throw new AppError("Invoice not found for webhook.", HTTP_STATUS.NOT_FOUND);
    if (invoice.status === "paid") return { success: true, message: "Already marked as paid" }; // Idempotency check

    return tenantStorage.run({ tenantId: invoice.tenant_id }, async () => {
      return db.$transaction(async (tx) => {
        const payment = await tx.payment.create({
          data: {
            tenant_id: invoice.tenant_id,
            invoice_id: invoiceId,
            amount: Number(amountPaid), // In paise, same minor-currency unit as invoice.total/amount_paid
            method: "ONLINE_GATEWAY",
            transaction_id: gatewayPaymentId,
            status: "success",
          },
        });

        const newAmountPaid = Number(invoice.amount_paid) + Number(amountPaid);
        const newStatus = newAmountPaid >= Number(invoice.total) ? "paid" : "partial";

        await tx.invoice.update({
          where: { invoice_id: invoiceId },
          data: { amount_paid: newAmountPaid, status: newStatus },
        });

        return payment;
      });
    });
  }
}