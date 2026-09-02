import { PlanReceiptRepository } from "../repositories/planReceiptRepository.js";
import { AuditService } from "./auditService.js";
import { AppError } from "../middlewares/errorHandler.js";
import { HTTP_STATUS } from "../constants/httpStatus.js";
import { db } from "../config/db.js";

export class PlanReceiptService {
  // Generates a receipt for a plan-subscription invoice that's already
  // been marked paid. This is a platform-billing artifact (the hospital's
  // subscription to this app), not a patient invoice -- separate from the
  // clinical invoice module entirely.
  static async generateReceipt({ tenantId, userId, invoiceId, ipAddress }) {
    const invoice = await db.invoice.findFirst({
      where: { invoice_id: invoiceId, tenant_id: tenantId },
    });
    if (!invoice)
      throw new AppError("Invoice not found.", HTTP_STATUS.NOT_FOUND);
    if (invoice.status !== "paid") {
      throw new AppError(
        "Cannot generate a receipt for an invoice that is not fully paid.",
        HTTP_STATUS.BAD_REQUEST,
      );
    }

    const existing = await PlanReceiptRepository.findByInvoice(
      invoiceId,
      tenantId,
    );
    if (existing) return existing;

    const tenant = await db.tenant.findUnique({
      where: { tenant_id: tenantId },
    });

    const receipt = await PlanReceiptRepository.create({
      tenantId,
      invoiceId,
      planId: tenant.plan_id,
      total: invoice.total,
      paidAt: new Date(),
      // pdfUrl/pdfPath intentionally left null here -- actual PDF
      // generation/storage needs the document-storage backend decision
      // that's still open (see migration 0050's comment on the `document`
      // table). Wire this up once that's decided rather than guessing at
      // a storage path now.
    });

    AuditService.logAction({
      tenantId,
      userId,
      action: "GENERATE_PLAN_RECEIPT",
      entityType: "PLAN_RECEIPT",
      entityId: receipt.receipt_id,
      newValue: { invoiceId, total: invoice.total },
      ipAddress,
    });

    return receipt;
  }

  static async getReceipt({ tenantId, receiptId }) {
    const receipt = await PlanReceiptRepository.findByIdAndTenant(
      receiptId,
      tenantId,
    );
    if (!receipt)
      throw new AppError("Receipt not found.", HTTP_STATUS.NOT_FOUND);
    return receipt;
  }

  static async listReceipts({ tenantId, query }) {
    const { page = 1, limit = 50 } = query;
    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    const [total, data] = await PlanReceiptRepository.findManyPaginated({
      tenantId,
      skip,
      take,
    });
    return { total, page: Number(page), pages: Math.ceil(total / take), data };
  }
}
