import { InvoiceRepository } from "../repositories/invoiceRepository.js";
import { AuditService } from "./auditService.js";
import { AppError } from "../middlewares/errorHandler.js";
import { HTTP_STATUS } from "../constants/httpStatus.js";

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

    const processedItems = items.map((item) => {
      if (item.quantity <= 0 || item.unitPrice < 0) {
        throw new AppError(
          "Quantity must be > 0 and unit price cannot be negative.",
          HTTP_STATUS.BAD_REQUEST,
        );
      }

      subtotal += item.quantity * item.unitPrice;
      return item;
    });

    // Calculate Tax and Total
    // taxRate is provided as an integer percentage (e.g., 18 for 18%)
    const gstTotal = Math.floor((subtotal * taxRate) / 100);
    const total = subtotal + gstTotal - discount;

    if (total < 0) {
      throw new AppError(
        "Discount cannot exceed the total invoice amount.",
        HTTP_STATUS.BAD_REQUEST,
      );
    }

    // Persist to DB via transaction — the repository generates the per-tenant sequential invoice_number under an advisory lock, in the same transaction as the insert.
    const invoice = await InvoiceRepository.createInvoiceTransaction({
      tenantId,
      patientId,
      subtotal,
      gstTotal,
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

  static async getInvoices({ tenantId, query }) {
    const { patientId, status, page = 1, limit = 50 } = query;
    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    const { total, invoices } = await InvoiceRepository.findManyPaginated({
      tenantId,
      patientId,
      status,
      skip,
      take,
    });

    return {
      total,
      page: Number(page),
      pages: Math.ceil(total / take),
      data: invoices,
    };
  }
}
