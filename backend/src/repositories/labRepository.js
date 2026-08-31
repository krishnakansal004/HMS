import { db } from '../config/db.js';

export class LabRepository {
  
  static async createTest(tenantId, data) {
    return db.lab_test.create({
      data: {
        tenant_id: tenantId,
        ...data
      }
    });
  }

  static async findTestById(tenantId, testId) {
    return db.lab_test.findFirst({
      where: { test_id: testId, tenant_id: tenantId }
    });
  }

  static async createOrder(tenantId, data) {
    return db.lab_order.create({
      data: {
        tenant_id: tenantId,
        ...data
      },
      include: {
        patient: { select: { first_name: true, last_name: true, phone: true } },
        lab_test: true
      }
    });
  }

  static async findOrderById(tenantId, orderId) {
    return db.lab_order.findFirst({
      where: { lab_order_id: orderId, tenant_id: tenantId },
      include: {
        patient: { select: { first_name: true, last_name: true, email: true, phone: true } },
        lab_test: true
      }
    });
  }

  static async updateOrderStatusTransaction({ tenantId, orderId, sampleStatus, technicianNotes, results, shouldBill, invoiceId, billingItem }) {
    return db.$transaction(async (tx) => {

      const updatedOrder = await tx.lab_order.update({
        where: { lab_order_id: orderId },
        data: {
          sample_status: sampleStatus,
          technician_notes: technicianNotes !== undefined ? technicianNotes : null,
          results: results ? JSON.parse(JSON.stringify(results)) : null,
          updated_at: new Date()
        },
        include: { lab_test: true, patient: true }
      });

      const actuallyBill = shouldBill && !!invoiceId;

      if (actuallyBill) {
        await tx.invoice_item.create({
          data: {
            tenant_id: tenantId,
            invoice_id: invoiceId,
            item_name_snapshot: billingItem.description,
            quantity: billingItem.quantity,
            unit_price_snapshot: billingItem.unitPrice,
            gst_rate_snapshot: billingItem.gstRate || 0
          }
        });

       // Recalculate invoice totals atomically
        const items = await tx.invoice_item.findMany({
          where: { invoice_id: invoiceId },
        });
        
        let subtotal = 0;
        let gstTotal = 0;
        
        items.forEach((i) => {
          const lineTotal = Number(i.unit_price_snapshot) * i.quantity;
          const lineGst = Math.floor((lineTotal * Number(i.gst_rate_snapshot)) / 100);
          subtotal += lineTotal;
          gstTotal += lineGst;
        });

        const invoice = await tx.invoice.findUnique({
          where: { invoice_id: invoiceId },
        });
        
        const discount = invoice ? Number(invoice.discount) : 0;
        const netTotal = subtotal + gstTotal - discount;

        await tx.invoice.update({
          where: { invoice_id: invoiceId },
          data: { subtotal, gst_total: gstTotal, total: netTotal },
        });
      }

      return updatedOrder;
    });
  }

  static async findOrdersPaginated({ tenantId, patientId, status, skip, take }) {
    const where = { tenant_id: tenantId };
    if (patientId) where.patient_id = patientId;
    if (status) where.sample_status = status;

    return db.$transaction(async (tx) => {
      const [total, orders] = await Promise.all([
        tx.lab_order.count({ where }),
        tx.lab_order.findMany({
          where,
          skip,
          take,
          orderBy: { created_at: 'desc' },
          include: {
            patient: { select: { first_name: true, last_name: true } }, 
            lab_test: { select: { name: true, code: true } }
          }
        })
      ]);
      return [total, orders];
    });
  }

  static async getCatalog(tenantId) {
    return db.lab_test.findMany({
      where: { tenant_id: tenantId },
      orderBy: { name: 'asc' }
    });
  }
}