import { db } from "../config/db.js";

export class PurchaseRepository {
  static async createPurchaseTransaction({
    tenantId,
    supplierId,
    orderId,
    orderDate,
    status,
    items,
  }) {
    return db.$transaction(async (tx) => {
      let totalCost = 0;

      const processedItems = items.map((item) => {
        const itemTotal = item.quantity * item.unitCost;
        totalCost += itemTotal;
        return {
          tenant_id: tenantId,
          medicine_id: item.medicineId,
          quantity: item.quantity,
          unit_cost_snapshot: item.unitCost,
        };
      });

      // Create Purchase Order and Items
      const purchase = await tx.purchase.create({
        data: {
          tenant_id: tenantId,
          supplier_id: supplierId,
          order_id: orderId || null,
          order_date: orderDate ? new Date(orderDate) : new Date(),
          total_cost: totalCost,
          status: status || "pending",
          purchase_item: {
            create: processedItems,
          },
        },
        include: {
          purchase_item: {
            include: { medicine: { select: { name: true, sku: true } } },
          },
          supplier: { select: { name: true, contact_phone: true } },
        },
      });

      // If status is completed upon creation, update inventory stock & movements immediately
      if (purchase.status === "completed") {
        for (const item of items) {
          // Update + movement-log write for one line item
          await Promise.all([
            tx.medicine.update({
              where: { medicine_id: item.medicineId },
              data: {
                quantity: { increment: item.quantity },
                updated_at: new Date(),
              },
            }),
            tx.stock_movement.create({
              data: {
                tenant_id: tenantId,
                medicine_id: item.medicineId,
                type: "PURCHASE",
                quantity: item.quantity,
                reference_id: purchase.purchase_id,
                notes: `Stock updated via purchase order ${orderId || purchase.purchase_id}`,
              },
            }),
          ]);
        }
      }

      return purchase;
    });
  }

  static async updateStatusTransaction({ tenantId, purchaseId, newStatus }) {
    return db.$transaction(async (tx) => {
      const purchase = await tx.purchase.findFirst({
        where: { purchase_id: purchaseId, tenant_id: tenantId },
        include: { purchase_item: true },
      });

      if (!purchase) throw new Error("PURCHASE_NOT_FOUND");

      const oldStatus = purchase.status;
      const allowedTransitions = {
        pending: ["ordered", "cancelled"],
        ordered: ["received", "cancelled"],
        received: ["completed", "cancelled"],
        completed: ["cancelled"],
        cancelled: [],
      };
      if (!allowedTransitions[oldStatus]?.includes(newStatus))
        throw new Error("INVALID_PURCHASE_TRANSITION");

      // Update status
      const updatedPurchase = await tx.purchase.update({
        where: { purchase_id: purchaseId },
        data: { status: newStatus, updated_at: new Date() },
      });

      // Handle stock adjustments based on state transition
      if (oldStatus !== "completed" && newStatus === "completed") {
        // Increment stock
        for (const item of purchase.purchase_item) {
          await tx.medicine.update({
            where: { medicine_id: item.medicine_id },
            data: { quantity: { increment: item.quantity } },
          });
          await tx.stock_movement.create({
            data: {
              tenant_id: tenantId,
              medicine_id: item.medicine_id,
              type: "PURCHASE",
              quantity: item.quantity,
              reference_id: purchaseId,
              notes: "Stock received on purchase completion",
            },
          });
        }
      } else if (oldStatus === "completed" && newStatus === "cancelled") {
        // Rollback stock if previously completed order is cancelled
        for (const item of purchase.purchase_item) {
          const decrement = await tx.medicine.updateMany({
            where: {
              medicine_id: item.medicine_id,
              tenant_id: tenantId,
              deleted_at: null,
              quantity: { gte: item.quantity },
            },
            data: { quantity: { decrement: item.quantity } },
          });
          if (decrement.count !== 1)
            throw new Error("INSUFFICIENT_STOCK_FOR_PURCHASE_REVERSAL");
          await tx.stock_movement.create({
            data: {
              tenant_id: tenantId,
              medicine_id: item.medicine_id,
              type: "ADJUSTMENT",
              quantity: -item.quantity,
              reference_id: purchaseId,
              notes: "Stock reversed after completed purchase cancellation",
            },
          });
        }
      }

      return updatedPurchase;
    });
  }

  static async findByIdAndTenant(tenantId, purchaseId) {
    return db.purchase.findFirst({
      where: { purchase_id: purchaseId, tenant_id: tenantId },
      include: {
        supplier: true,
        purchase_item: { include: { medicine: true } },
      },
    });
  }

  static async findManyPaginated({ tenantId, supplierId, status, skip, take }) {
    const where = { tenant_id: tenantId, deleted_at: null };
    if (supplierId) where.supplier_id = supplierId;
    if (status) where.status = status;

    // NOTE: return shape kept as a [total, purchases] tuple — unchanged —
    // because purchaseService.listPurchases() destructures it that way.
    return db.$transaction(async (tx) => {
      const [total, purchases] = await Promise.all([
        tx.purchase.count({ where }),
        tx.purchase.findMany({
          where,
          skip,
          take,
          orderBy: { created_at: "desc" },
          include: {
            supplier: { select: { name: true } },
            purchase_item: {
              include: { medicine: { select: { name: true, sku: true } } },
            },
          },
        }),
      ]);
      return [total, purchases];
    });
  }
}
