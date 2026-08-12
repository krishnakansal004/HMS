import { db } from '../config/db.js';

export class PurchaseRepository {
  
  static async createPurchaseTransaction({ tenantId, supplierId, orderId, orderDate, status, items }) {
    return db.$transaction(async (tx) => {
      let totalCost = 0;
      
      const processedItems = items.map(item => {
        const itemTotal = item.quantity * item.unitCost;
        totalCost += itemTotal;
        return {
          tenant_id: tenantId,
          medicine_id: item.medicineId,
          quantity: item.quantity,
          unit_cost_snapshot: item.unitCost
        };
      });

      // 1. Create Purchase Order and Items
      const purchase = await tx.purchase.create({
        data: {
          tenant_id: tenantId,
          supplier_id: supplierId,
          order_id: orderId || null,
          order_date: orderDate ? new Date(orderDate) : new Date(),
          total_cost: totalCost,
          status: status || 'pending',
          purchase_item: {
            create: processedItems
          }
        },
        include: {
          purchase_item: { include: { medicine: { select: { name: true, sku: true } } } },
          supplier: { select: { name: true, contact_phone: true } }
        }
      });

      // 2. If status is completed upon creation, update inventory stock & movements immediately
      if (purchase.status === 'completed') {
        for (const item of items) {
          await tx.medicine.update({
            where: { medicine_id: item.medicineId },
            data: {
              current_stock: { increment: item.quantity },
              updated_at: new Date()
            }
          });

          await tx.stock_movement.create({
            data: {
              tenant_id: tenantId,
              medicine_id: item.medicineId,
              type: 'PURCHASE',
              quantity: item.quantity,
              reference_id: purchase.purchase_id,
              notes: `Stock updated via purchase order ${orderId || purchase.purchase_id}`
            }
          });
        }
      }

      return purchase;
    });
  }

  static async updateStatusTransaction({ tenantId, purchaseId, newStatus }) {
    return db.$transaction(async (tx) => {
      const purchase = await tx.purchase.findFirst({
        where: { purchase_id: purchaseId, tenant_id: tenantId },
        include: { purchase_item: true }
      });

      if (!purchase) throw new Error('PURCHASE_NOT_FOUND');

      const oldStatus = purchase.status;

      // Update status
      const updatedPurchase = await tx.purchase.update({
        where: { purchase_id: purchaseId },
        data: { status: newStatus, updated_at: new Date() }
      });

      // Handle stock adjustments based on state transition
      if (oldStatus !== 'completed' && newStatus === 'completed') {
        // Increment stock
        for (const item of purchase.purchase_item) {
          await tx.medicine.update({
            where: { medicine_id: item.medicine_id },
            data: { current_stock: { increment: item.quantity } }
          });

          await tx.stock_movement.create({
            data: {
              tenant_id: tenantId,
              medicine_id: item.medicine_id,
              type: 'PURCHASE',
              quantity: item.quantity,
              reference_id: purchaseId,
              notes: `Stock updated on purchase status change to completed`
            }
          });
        }
      } else if (oldStatus === 'completed' && newStatus === 'cancelled') {
        // Rollback stock if previously completed order is cancelled
        for (const item of purchase.purchase_item) {
          await tx.medicine.update({
            where: { medicine_id: item.medicine_id },
            data: { current_stock: { decrement: item.quantity } }
          });

          await tx.stock_movement.create({
            data: {
              tenant_id: tenantId,
              medicine_id: item.medicine_id,
              type: 'ADJUSTMENT',
              quantity: -item.quantity,
              reference_id: purchaseId,
              notes: `Stock rolled back due to purchase cancellation`
            }
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
        purchase_item: { include: { medicine: true } }
      }
    });
  }

  static async findManyPaginated({ tenantId, supplierId, status, skip, take }) {
    const where = { tenant_id: tenantId };
    if (supplierId) where.supplier_id = supplierId;
    if (status) where.status = status;

    return db.$transaction([
      db.purchase.count({ where }),
      db.purchase.findMany({
        where,
        skip,
        take,
        orderBy: { created_at: 'desc' },
        include: {
          supplier: { select: { name: true } },
          purchase_item: { include: { medicine: { select: { name: true, sku: true } } } }
        }
      })
    ]);
  }
}