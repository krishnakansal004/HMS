import crypto from "crypto";
import Razorpay from "razorpay";
import { db, tenantStorage } from "../config/db.js";
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

    // SECURITY FIX: Backend calculates exact pending amount, never trust the frontend
    // SECURITY FIX: Backend calculates exact pending amount in minor currency (Paise)
    const pendingAmountPaise = Number(invoice.total) - Number(invoice.amount_paid);
    
    if (pendingAmountPaise <= 0) throw new AppError("No pending balance.", HTTP_STATUS.BAD_REQUEST);

    const rzp = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_SECRET,
    });

    const options = {
      amount: pendingAmountPaise, // <-- Removed the * 100 logic here
      currency: "INR",
      receipt: invoiceId.slice(0, 40), 
    };
    
    const order = await rzp.orders.create(options);
    
    return {
      ...order,
      patient: {
        name: `${invoice.patient.first_name} ${invoice.patient.last_name || ''}`.trim(),
        email: invoice.patient.email || '',
        contact: invoice.patient.phone || ''
      }
    };
  }

  // Real Signature Verification (Synchronous Frontend Callback)
  static async verifyPaymentWebhook({ invoiceId, gatewayPaymentId, razorpayOrderId, amountPaid, signature }) {
    const secret = process.env.RAZORPAY_SECRET; 

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
            amount: Number(amountPaid), // Assumes frontend sends this in Rupees
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