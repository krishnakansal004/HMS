import { db } from '../config/db.js';

export class PlanReceiptRepository {

  static async create({ tenantId, invoiceId, planId, total, paidAt, pdfUrl, pdfPath }) {
    return db.plan_receipt.create({
      data: {
        tenant_id: tenantId,
        invoice_id: invoiceId,
        plan_id: planId,
        total,
        paid_at: paidAt || new Date(),
        pdf_url: pdfUrl || null,
        pdf_path: pdfPath || null
      }
    });
  }

  static async findByIdAndTenant(receiptId, tenantId) {
    return db.plan_receipt.findFirst({
      where: { receipt_id: receiptId, tenant_id: tenantId },
      include: {
        plan: { select: { name: true } },
        invoice: { select: { invoice_number: true, status: true } }
      }
    });
  }

  static async findByInvoice(invoiceId, tenantId) {
    return db.plan_receipt.findFirst({
      where: { invoice_id: invoiceId, tenant_id: tenantId }
    });
  }

  static async findManyPaginated({ tenantId, skip, take }) {
    const where = { tenant_id: tenantId };

    return db.$transaction(async (tx) => {
      const [total, receipts] = await Promise.all([
        tx.plan_receipt.count({ where }),
        tx.plan_receipt.findMany({
          where,
          skip,
          take,
          orderBy: { created_at: 'desc' },
          include: {
            plan: { select: { name: true } },
            invoice: { select: { invoice_number: true } }
          }
        })
      ]);
      return [total, receipts];
    });
  }
}
