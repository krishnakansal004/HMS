import { db } from '../config/db.js';
import { queryAcrossTenants } from '../config/systemOwnerRawClient.js';

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

  static async createAcrossTenants(data, userRole) {
    return queryAcrossTenants(userRole, async (tx) => tx.plan_receipt.create({
      data: {
        tenant_id: data.tenantId,
        invoice_id: data.invoiceId,
        plan_id: data.planId,
        total: data.total,
        paid_at: data.paidAt || new Date(),
        pdf_url: data.pdfUrl || null,
        pdf_path: data.pdfPath || null,
      },
    }));
  }

  static async findInvoiceAcrossTenants(invoiceId, userRole) {
    return queryAcrossTenants(userRole, async (tx) => tx.invoice.findFirst({
      where: { invoice_id: invoiceId },
    }));
  }

  static async findTenantAcrossTenants(tenantId, userRole) {
    return queryAcrossTenants(userRole, async (tx) => tx.tenant.findUnique({
      where: { tenant_id: tenantId },
    }));
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

  static async findByIdAcrossTenants(receiptId, userRole) {
    return queryAcrossTenants(userRole, async (tx) => tx.plan_receipt.findUnique({
      where: { receipt_id: receiptId },
      include: {
        plan: { select: { name: true } },
        invoice: { select: { invoice_number: true, status: true } },
      },
    }));
  }

  static async findByInvoice(invoiceId, tenantId) {
    return db.plan_receipt.findFirst({
      where: { invoice_id: invoiceId, tenant_id: tenantId }
    });
  }

  static async findByInvoiceAcrossTenants(invoiceId, userRole) {
    return queryAcrossTenants(userRole, async (tx) => tx.plan_receipt.findFirst({
      where: { invoice_id: invoiceId },
    }));
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

  static async findManyPaginatedAcrossTenants({ userRole, skip, take }) {
    return queryAcrossTenants(userRole, async (prisma) => prisma.$transaction(async (tx) => {
      const [total, receipts] = await Promise.all([
        tx.plan_receipt.count(),
        tx.plan_receipt.findMany({
          skip,
          take,
          orderBy: { created_at: 'desc' },
          include: {
            plan: { select: { name: true } },
            invoice: { select: { invoice_number: true } },
            tenant: { select: { name: true, slug: true } },
          },
        }),
      ]);
      return [total, receipts];
    }));
  }
}
