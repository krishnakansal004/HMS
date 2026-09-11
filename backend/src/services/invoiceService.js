import { InvoiceRepository } from "../repositories/invoiceRepository.js";
import { AuditService } from "./auditService.js";
import { AppError } from "../middlewares/errorHandler.js";
import { HTTP_STATUS } from "../constants/httpStatus.js";
import {db} from "../config/db.js"
import { addPdfJob } from "../queues/pdfQueue.js";
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

  static async getPatientCharges({ tenantId, patientId }) {
    const patient = await db.patient.findFirst({
      where: { patient_id: patientId, tenant_id: tenantId, deleted_at: null },
      select: { patient_id: true },
    });
    if (!patient) throw new AppError('Patient not found.', HTTP_STATUS.NOT_FOUND);

    const [appointments, labOrders, prescriptions, medicines, invoicedItems] = await Promise.all([
      db.appointment.findMany({
        where: { tenant_id: tenantId, patient_id: patientId, deleted_at: null, status: { notIn: ['cancelled', 'no_show'] } },
        include: { doctor_profile: { select: { consultation_fee: true } } },
        orderBy: { slot_start: 'asc' },
      }),
      db.lab_order.findMany({
        where: { tenant_id: tenantId, patient_id: patientId, deleted_at: null, sample_status: { not: 'cancelled' } },
        include: { lab_test: { select: { price: true } } },
        orderBy: { created_at: 'asc' },
      }),
      db.prescription.findMany({
        where: { tenant_id: tenantId, patient_id: patientId, deleted_at: null },
        select: { prescription_id: true, medicines: true },
        orderBy: { created_at: 'asc' },
      }),
      db.medicine.findMany({
        where: { tenant_id: tenantId, deleted_at: null },
        select: { name: true, selling_price: true },
      }),
      db.invoice_item.findMany({
        where: {
          tenant_id: tenantId,
          source_key: { not: null },
          invoice: { patient_id: patientId, deleted_at: null },
        },
        select: { source_key: true },
      }),
    ]);

    const invoiced = new Set(invoicedItems.map((item) => item.source_key));
    const charges = [];
    const addCharge = (charge) => {
      if (charge.unitPrice > 0 && !invoiced.has(charge.sourceKey)) charges.push(charge);
    };

    appointments.forEach((appointment) => addCharge({
      entityType: 'CONSULTATION',
      entityId: appointment.appointment_id,
      sourceKey: `appointment:${appointment.appointment_id}`,
      description: `Consultation with Dr. ${appointment.doctor_name_snapshot}`,
      quantity: 1,
      unitPrice: Math.round(Number(appointment.doctor_profile.consultation_fee || 0) * 100),
      gstRate: 0,
    }));

    labOrders.forEach((order) => addCharge({
      entityType: 'LAB',
      entityId: order.lab_order_id,
      sourceKey: `lab:${order.lab_order_id}`,
      description: `Lab Test: ${order.test_name_snapshot}`,
      quantity: 1,
      unitPrice: Math.round(Number(order.lab_test.price || 0)),
      gstRate: 0,
    }));

    const medicinePrices = new Map(medicines.map((medicine) => [medicine.name.trim().toLowerCase(), Number(medicine.selling_price || 0)]));
    prescriptions.forEach((prescription) => {
      const prescribedMedicines = Array.isArray(prescription.medicines) ? prescription.medicines : [];
      prescribedMedicines.forEach((medicine, index) => {
        const name = String(medicine.name || '').trim();
        addCharge({
          entityType: 'MEDICINE',
          sourceKey: `prescription:${prescription.prescription_id}:${index}`,
          description: `Medicine: ${name || 'Prescribed medicine'}`,
          quantity: 1,
          unitPrice: Math.round((medicinePrices.get(name.toLowerCase()) || 0) * 100),
          gstRate: 0,
        });
      });
    });

    return { data: charges, total: charges.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0) };
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
      if (updatedInvoice.status === 'paid') {
        addPdfJob({
          invoiceId: updatedInvoice.invoice_id,
          tenantId: tenantId,
          paidAt: payment.created_at
        }).catch(err => console.error('[InvoiceService] Failed to queue PDF job:', err));
      }
      
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
