import { db } from '../config/db.js';
import { AppError } from '../middlewares/errorHandler.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';

export class PaymentService {
  
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