import { db } from '../config/db.js';

export class PurchaseRepository {
  static async createPurchaseTransaction({ tenantId, supplierId, orderId, orderDate, status, items }) {
    return db.$transaction(async (tx) => {
      let totalCost = 0;
      const processedItems = items.map(item => {
        const itemTotal = item.quantity * item.unitCost;
        totalCost += itemTotal;
        return {
          medicine_id: item.medicineId,
          quantity: item.quantity,
          unit_cost_snapshot: item.unitCost
        };
      });

      const purchase = await tx.purchase.create({
        data: {
          tenant_id: tenantId,
          supplier_id: supplierId,
          order_id: orderId || null,
          order_date: orderDate ? new Date(orderDate) : new Date(),
          total_cost: totalCost,
          status: status || 'pending',
          purchase_item: { create: processedItems }
        },
        include: {
          purchase_item: { 
            include: { 
              medicine: { 
                select: { 
                  tenant_id: true, 
                  medicine_id: true, 
                  name: true, 
                  batch_number: true 
                } 
              } 
            } 
          },
          supplier: { 
            select: { 
              tenant_id: true, 
              supplier_id: true, 
              name: true, 
              contact_phone: true 
            } 
          }
        }
      });

      if (purchase.status === 'completed') {
        for (const item of items) {
          await Promise.all([
            tx.medicine.update({
              where: { medicine_id: item.medicineId },
              data: { quantity: { increment: item.quantity }, updated_at: new Date() }
            }),
            tx.stock_movement.create({
              data: {
                tenant_id: tenantId, medicine_id: item.medicineId, type: 'PURCHASE',
                quantity: item.quantity, reference_id: purchase.purchase_id,
                notes: `Stock updated via purchase order ${orderId || purchase.purchase_id}`
              }
            })
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
        include: { purchase_item: true }
      });

      if (!purchase) throw new Error('PURCHASE_NOT_FOUND');

      const oldStatus = purchase.status;
      const allowedTransitions = {
        pending: ['ordered', 'cancelled'],
        ordered: ['received', 'cancelled'],
        received: ['completed', 'cancelled'],
        completed: ['cancelled'],
        cancelled: [],
      };

      if (!allowedTransitions[oldStatus]?.includes(newStatus)) throw new Error('INVALID_PURCHASE_TRANSITION');

      const updatedPurchase = await tx.purchase.update({
        where: { purchase_id: purchaseId },
        data: { status: newStatus, updated_at: new Date() }
      });

      if (oldStatus !== 'completed' && newStatus === 'completed') {
        for (const item of purchase.purchase_item) {
          await tx.medicine.update({
            where: { medicine_id: item.medicine_id },
            data: { quantity: { increment: item.quantity } }
          });
          await tx.stock_movement.create({
            data: { tenant_id: tenantId, medicine_id: item.medicine_id, type: 'PURCHASE', quantity: item.quantity, reference_id: purchaseId, notes: 'Stock received on purchase completion' }
          });
        }
      } else if (oldStatus === 'completed' && newStatus === 'cancelled') {
        for (const item of purchase.purchase_item) {
          const decrement = await tx.medicine.updateMany({
            where: { medicine_id: item.medicine_id, tenant_id: tenantId, deleted_at: null, quantity: { gte: item.quantity } },
            data: { quantity: { decrement: item.quantity } }
          });
          if (decrement.count !== 1) throw new Error('INSUFFICIENT_STOCK_FOR_PURCHASE_REVERSAL');
          await tx.stock_movement.create({
            data: { tenant_id: tenantId, medicine_id: item.medicine_id, type: 'ADJUSTMENT', quantity: -item.quantity, reference_id: purchaseId, notes: 'Stock reversed after completed purchase cancellation' }
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
        supplier: { 
          select: { tenant_id: true, supplier_id: true, name: true, contact_phone: true } 
        },
        purchase_item: { 
          include: { 
            medicine: { select: { tenant_id: true, medicine_id: true, name: true, batch_number: true } } 
          } 
        }
      }
    });
  }

  static async findManyPaginated({ tenantId, supplierId, status, skip, take }) {
    const where = { tenant_id: tenantId, deleted_at: null };
    if (supplierId) where.supplier_id = supplierId;
    if (status) where.status = status;

    return db.$transaction(async (tx) => {
      const [total, purchases] = await Promise.all([
        tx.purchase.count({ where }),
        tx.purchase.findMany({
          where, skip, take, orderBy: { created_at: 'desc' },
          include: {
            supplier: { 
              select: { tenant_id: true, supplier_id: true, name: true } 
            },
            purchase_item: { 
              include: { 
                medicine: { select: { tenant_id: true, medicine_id: true, name: true, batch_number: true } } 
              } 
            }
          }
        })
      ]);
      return [total, purchases];
    });
  }
}