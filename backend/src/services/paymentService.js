import { db } from '../config/db.js';
import { razorpay } from '../config/razorpay.js';
import { env } from '../config/env.js';
import { InvoiceRepository } from '../repositories/invoiceRepository.js';
import { AppError } from '../middlewares/errorHandler.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';

export class PaymentService {

  static async initiatePayment({ tenantId, invoiceId }) {
    const invoice = await InvoiceRepository.findByIdAndTenant(invoiceId, tenantId);
    if (!invoice) {
      throw new AppError('Invoice not found.', HTTP_STATUS.NOT_FOUND);
    }

    if (invoice.status === 'paid' || invoice.status === 'cancelled') {
      throw new AppError(`Cannot initiate payment for a ${invoice.status} invoice.`, HTTP_STATUS.BAD_REQUEST);
    }

    const balance = Number(invoice.total) - Number(invoice.amount_paid);
    if (balance <= 0) {
      throw new AppError('This invoice has no outstanding balance.', HTTP_STATUS.BAD_REQUEST);
    }

    // invoice.total / amount_paid are already stored in paise (minor units),
    // so balance is already in paise — Razorpay just needs it rounded to an integer.
    const amountInPaise = Math.round(balance);

    const order = await razorpay.orders.create({
      amount: amountInPaise,
      currency: 'INR',
      receipt: invoice.invoice_id,
      notes: { tenantId, invoiceId: invoice.invoice_id }
    });

    return {
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: env.razorpay.keyId,
      invoiceId: invoice.invoice_id
    };
  }

  static async verifyPaymentWebhook({ invoiceId, gatewayPaymentId, amountPaid, signature }) {
    // Cryptographic webhook verification logic for Razorpay/Stripe can be plugged here
    const invoice = await db.invoice.findUnique({ where: { invoice_id: invoiceId } });
    if (!invoice) throw new AppError('Invoice not found for webhook.', HTTP_STATUS.NOT_FOUND);

    const payment = await db.payment.create({
      data: {
        tenant_id: invoice.tenant_id,
        invoice_id: invoiceId,
        amount: Number(amountPaid),
        method: 'ONLINE_GATEWAY',
        transaction_id: gatewayPaymentId,
        status: 'SUCCESS'
      }
    });

    const newAmountPaid = Number(invoice.amount_paid) + Number(amountPaid);
    const newStatus = newAmountPaid >= Number(invoice.total) ? 'paid' : 'partial';

    await db.invoice.update({
      where: { invoice_id: invoiceId },
      data: { amount_paid: newAmountPaid, status: newStatus }
    });

    return payment;
  }
}