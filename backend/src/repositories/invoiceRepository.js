import { db } from '../config/db.js';

export class InvoiceRepository {

 static async createInvoiceTransaction({ tenantId, patientId, subtotal, gstTotal, total, status, items }) {
    return db.$transaction(async (tx) => {
      // Serialize invoice-number generation per tenant
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
          paid: false,
          status,
          invoice_item: {
            create: items.map(item => ({
              medicine_id: (item.entityType === 'MEDICINE' ? item.entityId : item.medicineId) || null,
              item_name_snapshot: item.description || item.itemName || 'Medical Service',
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
      where: { invoice_id: invoiceId, tenant_id: tenantId, deleted_at: null },
      include: { invoice_item: true, payment: true }
    });
  }

  static async recordPaymentTransaction({ tenantId, invoiceId, amount, method, transactionId }) {
    return db.$transaction(async (tx) => {
      // Lock invoice row strictly using SELECT ... FOR UPDATE to serialize concurrent payments
      const [lockedInvoice] = await tx.$queryRaw`
        SELECT invoice_id, total, amount_paid, status, paid
        FROM invoice
        WHERE invoice_id = ${invoiceId}::uuid
          AND tenant_id = ${tenantId}::uuid
          AND deleted_at IS NULL
        FOR UPDATE
      `;

      if (!lockedInvoice) throw new Error('INVOICE_NOT_FOUND');

      const currentTotal = Number(lockedInvoice.total);
      const currentPaid = Number(lockedInvoice.amount_paid);
      const paymentAmount = Number(amount);
      const remainingBalance = currentTotal - currentPaid;

      if (paymentAmount > remainingBalance) {
        throw new Error('PAYMENT_EXCEEDS_BALANCE');
      }

      // Create the payment record
      const payment = await tx.payment.create({
        data: {
          tenant_id: tenantId,
          invoice_id: invoiceId,
          amount: paymentAmount,
          method,
          transaction_id: transactionId,
          status: 'success'
        }
      });

      const newAmountPaid = currentPaid + paymentAmount;
      const isFullyPaid = newAmountPaid >= currentTotal;
      const newStatus = isFullyPaid ? 'paid' : 'partial';

      // Update invoice running total + status
      const updatedInvoice = await tx.invoice.update({
        where: { invoice_id: invoiceId },
        data: {
          amount_paid: newAmountPaid,
          paid: isFullyPaid,
          status: newStatus,
          updated_at: new Date()
        },
        include: { invoice_item: true, payment: true }
      });

      return { payment, updatedInvoice };
    });
  }

  static async findManyPaginated({ tenantId, patientId, status, skip, take }) {
    const where = { tenant_id: tenantId, deleted_at: null };

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