import { db } from '../config/db.js';
import { AppError } from '../middlewares/errorHandler.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';

export class PaymentService {
  
  static async verifyPaymentWebhook(webhookPayload) {
    // 1. Validate signature & extract metadata
    const tenantId = webhookPayload.payload.payment.entity.notes.tenant_id;
    const invoiceId = webhookPayload.payload.payment.entity.notes.invoice_id;
    const amount = webhookPayload.payload.payment.entity.amount / 100;

    return db.$transaction(async (tx) => {
      // 2. Manually inject the tenant context for PostgreSQL RLS bypass
      await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}::text, true)`;

      // 3. Perform atomic payment creation
      await tx.payment.create({
        data: {
          tenant_id: tenantId,
          invoice_id: invoiceId,
          amount: amount,
          method: 'WEBHOOK',
          status: 'success'
        }
      });

      // 4. Perform atomic invoice increment (prevents race conditions)
      const atomicInvoice = await tx.invoice.update({
        where: { invoice_id: invoiceId },
        data: { amount_paid: { increment: amount } },
        select: { total: true, amount_paid: true }
      });

      // 5. Strictly evaluate the new balance
      const newStatus = Number(atomicInvoice.amount_paid) >= Number(atomicInvoice.total) ? 'paid' : 'partial';

      await tx.invoice.update({
        where: { invoice_id: invoiceId },
        data: { 
          status: newStatus,
          paid: newStatus === 'paid',
          updated_at: new Date()
        }
      });
    });
  }
}