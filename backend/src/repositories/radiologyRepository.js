import { db } from "../config/db.js";

export class RadiologyRepository {
  static async createOrder(tenantId, data) {
    return db.radiology_order.create({
      data: {
        tenant_id: tenantId,
        ...data,
      },
      include: {
        patient: { select: { first_name: true, last_name: true, phone: true } },
        doctor_profile: { include: { users: { select: { name: true } } } },
      },
    });
  }

  static async findOrderById(tenantId, orderId) {
    return db.radiology_order.findFirst({
      where: { radiology_order_id: orderId, tenant_id: tenantId },
      include: {
        patient: {
          select: {
            first_name: true,
            last_name: true,
            email: true,
            phone: true,
          },
        },
        doctor_profile: {
          include: { users: { select: { name: true, email: true } } },
        },
      },
    });
  }

  static async updateOrderTransaction({
    tenantId,
    orderId,
    status,
    findings,
    impression,
    scanMetadata,
    shouldBill,
    invoiceId,
    billingItem,
  }) {
    return db.$transaction(async (tx) => {
      const actuallyBill = shouldBill && !!invoiceId;

      const updatedOrder = await tx.radiology_order.update({
        where: { radiology_order_id: orderId },
        data: {
          status, // or sample_status for lab
          findings: findings !== undefined ? findings : undefined,
          impression: impression !== undefined ? impression : undefined,
          scan_metadata: scanMetadata
            ? JSON.parse(JSON.stringify(scanMetadata))
            : undefined,
          billing_status: actuallyBill ? "billed" : undefined,
          updated_at: new Date(),
        },
      });
      // If completed and billing requested, append charge to the invoice item list
      if (shouldBill && invoiceId) {
        await tx.invoice_item.create({
          data: {
            tenant_id: tenantId,
            invoice_id: invoiceId,
            item_name_snapshot: billingItem.description,
            quantity: billingItem.quantity,
            unit_price_snapshot: billingItem.unitPrice,
            gst_rate_snapshot: billingItem.gstRate || 0,
          },
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

  static async findOrdersPaginated({
    tenantId,
    patientId,
    status,
    skip,
    take,
  }) {
    const where = { tenant_id: tenantId };
    if (patientId) where.patient_id = patientId;
    if (status) where.status = status;

    return db.$transaction(async (tx) => {
      const [total, orders] = await Promise.all([
        tx.radiology_order.count({ where }),
        tx.radiology_order.findMany({
          where,
          skip,
          take,
          orderBy: { created_at: "desc" },
          include: {
            patient: { select: { first_name: true, last_name: true } },
            doctor_profile: { include: { users: { select: { name: true } } } },
          },
        }),
      ]);
      return [total, orders];
    });
  }
}
