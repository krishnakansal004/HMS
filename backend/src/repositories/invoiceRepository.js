import { db } from '../config/db.js';

export class InvoiceRepository {

  static async createInvoiceTransaction({ tenantId, patientId, subtotal, gstTotal, total, status, items }) {
    return db.$transaction(async (tx) => {
      // Serialize invoice-number generation per tenant using a transaction-scoped
      // advisory lock (auto-released at commit/rollback, no extra counter table
      // needed). Without this, two concurrent invoices for the same tenant could
      // both read the same MAX(invoice_number) and collide on the
      // uq_invoice_tenant_number constraint.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${tenantId}::text))`;
      const [{ next_number }] = await tx.$queryRaw`
        SELECT COALESCE(MAX(invoice_number), 0) + 1 AS next_number
        FROM invoice WHERE tenant_id = ${tenantId}::uuid
      `;
      const invoiceNumber = Number(next_number);

      const invoice = await tx.invoice.create({
        data: {
          tenant_id: tenantId,
          patient_id: patientId,
          invoice_number: invoiceNumber,
          subtotal,
          gst_total: gstTotal,
          total,
          amount_paid: 0,
          status,
          invoice_item: {
            create: items.map(item => ({
              tenant_id: tenantId,
              medicine_id: item.medicineId ?? null,
              item_name_snapshot: item.itemName,
              quantity: item.quantity,
              unit_price_snapshot: item.unitPrice,
              gst_rate_snapshot: item.gstRate ?? 0
            }))
          }
        },
        include: {
          invoice_item: true,
          patient: { select: { first_name: true, last_name: true, email: true, phone: true } }
        }
      });

      return invoice;
    });
  }

  static async findByIdAndTenant(invoiceId, tenantId) {
    return db.invoice.findFirst({
      where: { invoice_id: invoiceId, tenant_id: tenantId },
      include: { invoice_item: true, payment: true }
    });
  }

  static async recordPaymentTransaction({ tenantId, invoiceId, amount, method, transactionId }) {
    return db.$transaction(async (tx) => {
      // Create the payment record
      const payment = await tx.payment.create({
        data: {
          tenant_id: tenantId,
          invoice_id: invoiceId,
          amount,
          method,
          transaction_id: transactionId,
          status: 'success'
        }
      });

      // Fetch current invoice totals
      const invoice = await tx.invoice.findFirst({
        where: { invoice_id: invoiceId, tenant_id: tenantId },
        select: { invoice_id: true, total: true, amount_paid: true }
      });

      if (!invoice) throw new Error('INVOICE_NOT_FOUND');

      const newAmountPaid = Number(invoice.amount_paid) + Number(amount);
      let newStatus = 'partial';

      if (newAmountPaid >= Number(invoice.total)) {
        newStatus = 'paid';
      }

      // Update invoice running total + status
      const updatedInvoice = await tx.invoice.update({
        where: { invoice_id: invoiceId },
        data: {
          amount_paid: newAmountPaid,
          paid: newStatus === 'paid',
          status: newStatus
        },
        include: { invoice_item: true, payment: true }
      });

      return { payment, updatedInvoice };
    });
  }

  static async findManyPaginated({ tenantId, patientId, status, skip, take }) {
    const where = { tenant_id: tenantId };

    if (patientId) where.patient_id = patientId;
    if (status) where.status = status;

    // Callback form, not array-batch: array-batch $transaction can't apply
    // SET LOCAL per statement (see db.js), so it would silently run without
    // tenant context under RLS.
    return db.$transaction(async (tx) => {
      const [total, invoices] = await Promise.all([
        tx.invoice.count({ where }),
        tx.invoice.findMany({
          where,
          skip,
          take,
          orderBy: { created_at: 'desc' },
          include: {
            patient: { select: { first_name: true, last_name: true } }
          }
        })
      ]);
      return { total, invoices };
    });
  }
}