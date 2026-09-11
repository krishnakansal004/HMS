import crypto from "crypto";
import Razorpay from "razorpay";
import { db, tenantStorage } from "../config/db.js";
import { AppError } from "../middlewares/errorHandler.js";
import { HTTP_STATUS } from "../constants/httpStatus.js";
import { env } from "../config/env.js";

export class PaymentService {
  // Initiation Flow
  static async createPaymentOrder({ tenantId, invoiceId, userId, userRole }) {

    let ownPatientId = null;
    if (userRole === "PATIENT") {
      const ownPatientRecord = await db.patient.findFirst({
        where: { user_id: userId, tenant_id: tenantId },
        select: { patient_id: true },
      });
      if (!ownPatientRecord) {
        throw new AppError("Invoice not found.", HTTP_STATUS.NOT_FOUND);
      }
      ownPatientId = ownPatientRecord.patient_id;
    }

    // Fetch invoice and patient details for UI prefill
    const invoice = await db.invoice.findFirst({
      where: {
        invoice_id: invoiceId,
        tenant_id: tenantId,
        ...(ownPatientId ? { patient_id: ownPatientId } : {}),
      },
      include: {
        patient: {
          select: {
            first_name: true,
            last_name: true,
            email: true,
            phone: true,
          },
        },
      },
    });

    if (!invoice)
      throw new AppError("Invoice not found.", HTTP_STATUS.NOT_FOUND);
    if (invoice.status === "paid")
      throw new AppError("Invoice is already paid.", HTTP_STATUS.BAD_REQUEST);

    const pendingAmountPaise =
      Number(invoice.total) - Number(invoice.amount_paid);

    if (pendingAmountPaise <= 0)
      throw new AppError("No pending balance.", HTTP_STATUS.BAD_REQUEST);

    const rzp = new Razorpay({
      key_id: env.razorpay.keyId,
      key_secret: env.razorpay.keySecret,
    });

    const currencySetting = await db.setting.findFirst({
      where: { tenant_id: tenantId, key: "CURRENCY" },
    });

    const currency = currencySetting?.value || "INR";
    const options = {
      amount: pendingAmountPaise,
      currency,
      receipt: invoiceId.slice(0, 40),
    };

    const order = await rzp.orders.create(options);
    await db.invoice.update({
      where: { invoice_id: invoiceId },
      data: { razorpay_order_id: order.id },
    });

    return {
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: env.razorpay.keyId,
      patient: {
        name: `${invoice.patient.first_name} ${invoice.patient.last_name || ""}`.trim(),
        email: invoice.patient.email || "",
        contact: invoice.patient.phone || "",
      },
    };
  }

  // Real Signature Verification (Synchronous Frontend Callback)
  static async verifyPaymentWebhook({
    invoiceId,
    gatewayPaymentId,
    razorpayOrderId,
    amountPaid,
    signature,
  }) {
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

    if (!invoice || invoice.invoice_id !== invoiceId) {
      throw new AppError(
        "Invoice mismatch or not found.",
        HTTP_STATUS.NOT_FOUND,
      );
    }
    if (!invoice.razorpay_order_id || invoice.razorpay_order_id !== razorpayOrderId) {
      throw new AppError(
        "Razorpay order does not match this invoice.",
        HTTP_STATUS.BAD_REQUEST,
      );
    }
    if (invoice.status === "paid")
      return { success: true, message: "Already marked as paid" }; // Idempotency check

    // Convert incoming amountPaid to minor currency (paise)
    const remainingPaise = Number(invoice.total) - Number(invoice.amount_paid);
    let amountInPaise = Math.round(Number(amountPaid) * 100);
    if (
      Math.round(Number(amountPaid)) === remainingPaise ||
      (Number(amountPaid) > remainingPaise &&
        Math.round(Number(amountPaid)) <= Number(invoice.total))
    ) {
      amountInPaise = Math.round(Number(amountPaid));
    }
    if (!Number.isFinite(amountInPaise) || amountInPaise <= 0 || amountInPaise > remainingPaise) {
      throw new AppError(
        "Payment amount does not match the invoice balance.",
        HTTP_STATUS.BAD_REQUEST,
      );
    }

    return tenantStorage.run({ tenantId: invoice.tenant_id }, async () => {
      return db.$transaction(async (tx) => {
        // Lock invoice row to prevent concurrent webhook/payment race conditions
        const [lockedInvoice] = await tx.$queryRaw`
          SELECT invoice_id, total, amount_paid, status, paid
          FROM invoice
          WHERE invoice_id = ${invoiceId}::uuid
            AND tenant_id = ${invoice.tenant_id}::uuid
            AND deleted_at IS NULL
          FOR UPDATE
        `;

        const targetInvoice = lockedInvoice || invoice;
        if (targetInvoice.status === "paid") {
          return { success: true, message: "Already marked as paid" };
        }

        const payment = await tx.payment.create({
          data: {
            tenant_id: invoice.tenant_id,
            invoice_id: invoiceId,
            amount: amountInPaise,
            method: "ONLINE_GATEWAY",
            transaction_id: gatewayPaymentId,
            status: "success",
          },
        });

        const newAmountPaid = Number(targetInvoice.amount_paid) + amountInPaise;
        const isFullyPaid = newAmountPaid >= Number(targetInvoice.total);
        const newStatus = isFullyPaid ? "paid" : "partial";

        await tx.invoice.update({
          where: { invoice_id: invoiceId },
          data: {
            amount_paid: newAmountPaid,
            paid: isFullyPaid,
            status: newStatus,
            updated_at: new Date(),
          },
        });

        return payment;
      });
    });
  }
}
