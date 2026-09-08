import { InvoiceRepository } from "../repositories/invoiceRepository.js";
import { AuditService } from "./auditService.js";
import { AppError } from "../middlewares/errorHandler.js";
import { HTTP_STATUS } from "../constants/httpStatus.js";
import {db} from "../config/db.js"
export class InvoiceService {
  static async generateInvoice({
    tenantId,
    userId,
    patientId,
    items,
    discount = 0,
    taxRate = 0,
    ipAddress,
  }) {
    // items array expects { itemName, medicineId?, quantity, unitPrice, gstRate? }
    let subtotal = 0;
    let gstTotal = 0;

    const processedItems = items.map((item) => {
      if (item.quantity <= 0 || item.unitPrice < 0) {
        throw new AppError("Quantity must be > 0 and unit price cannot be negative.", HTTP_STATUS.BAD_REQUEST);
      }
      
      const lineTotal = item.quantity * item.unitPrice;
      const lineGst = Math.round((lineTotal * (item.gstRate || 0)) / 100);
      
      subtotal += lineTotal;
      gstTotal += lineGst;
      return item;
    });

    const total = subtotal + gstTotal - discount;
    if (total < 0) {
      throw new AppError("Discount cannot exceed the total invoice amount.", HTTP_STATUS.BAD_REQUEST);
    }

    // Persist to DB via transaction — the repository generates the per-tenant sequential invoice_number under an advisory lock, in the same transaction as the insert.
    const invoice = await InvoiceRepository.createInvoiceTransaction({
      tenantId,
      patientId,
      subtotal,
      gstTotal,
      discount,
      total,
      status: "pending",
      items: processedItems,
    });

    // Audit Logging
    AuditService.logAction({
      tenantId,
      userId,
      action: "GENERATE_INVOICE",
      entityType: "INVOICE",
      entityId: invoice.invoice_id,
      newValue: { invoiceNumber: invoice.invoice_number, total },
      ipAddress,
    });

    return invoice;
  }

  static async recordPayment({
    tenantId,
    userId,
    invoiceId,
    amount,
    method,
    transactionId,
    ipAddress,
  }) {
    if (amount <= 0) {
      throw new AppError(
        "Payment amount must be greater than zero.",
        HTTP_STATUS.BAD_REQUEST,
      );
    }

    const invoice = await InvoiceRepository.findByIdAndTenant(
      invoiceId,
      tenantId,
    );
    if (!invoice) {
      throw new AppError("Invoice not found.", HTTP_STATUS.NOT_FOUND);
    }

    if (invoice.status === "paid" || invoice.status === "cancelled") {
      throw new AppError(
        `Cannot apply payment to a ${invoice.status} invoice.`,
        HTTP_STATUS.BAD_REQUEST,
      );
    }

    const remainingBalance =
      Number(invoice.total) - Number(invoice.amount_paid);
    if (amount > remainingBalance) {
      throw new AppError(
        "Payment amount exceeds the remaining invoice balance.",
        HTTP_STATUS.BAD_REQUEST,
      );
    }

    try {
      const { updatedInvoice, payment } =
        await InvoiceRepository.recordPaymentTransaction({
          tenantId,
          invoiceId,
          amount,
          method,
          transactionId,
        });

      AuditService.logAction({
        tenantId,
        userId,
        action: "RECORD_PAYMENT",
        entityType: "INVOICE",
        entityId: invoice.invoice_id,
        newValue: {
          amountPaid: amount,
          method,
          newStatus: updatedInvoice.status,
        },
        ipAddress,
      });

      // TODO: If updatedInvoice.status === 'paid', push a job to BullMQ to send a PDF Receipt to the patient's email.

      return updatedInvoice;
    } catch (error) {
      if (error.message === "INVOICE_NOT_FOUND") {
        throw new AppError(
          "Invoice could not be processed during transaction.",
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
        );
      }
      throw error;
    }
  }

  static async getInvoices({ tenantId, userId, userRole, query }) {
    let { patientId, status, page = 1, limit = 50 } = query;
    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    // PATIENT ISOLATION ENFORCEMENT
    if (userRole === 'PATIENT') {
      const ownPatientRecord = await db.patient.findFirst({
        where: { user_id: userId, tenant_id: tenantId },
        select: { patient_id: true }
      });
      if (!ownPatientRecord) {
        return { total: 0, page: Number(page), pages: 0, data: [] };
      }
      patientId = ownPatientRecord.patient_id;
    }

    const { total, invoices } = await InvoiceRepository.findManyPaginated({
      tenantId, patientId, status, skip, take,
    });

    return { total, page: Number(page), pages: Math.ceil(total / take), data: invoices };
  }

  static async getSummary(tenantId) {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    return db.$transaction(async (tx) => {
      const outstanding = await tx.invoice.aggregate({
        where: { tenant_id: tenantId, status: { in: ['pending', 'partial'] }, deleted_at: null },
        _sum: { total: true, amount_paid: true },
        _count: { invoice_id: true }
      });

      const todayPayments = await tx.payment.aggregate({
        where: { tenant_id: tenantId, status: 'success', created_at: { gte: today }, deleted_at: null },
        _sum: { amount: true },
        _count: { payment_id: true }
      });

      const total = Number(outstanding._sum.total || 0);
      const paid = Number(outstanding._sum.amount_paid || 0);

      return {
        outstandingTotal: total - paid,
        outstandingInvoiceCount: outstanding._count.invoice_id || 0,
        todayCollectedTotal: Number(todayPayments._sum.amount || 0),
        todayCollectedCount: todayPayments._count.payment_id || 0
      };
    });
  }
}
