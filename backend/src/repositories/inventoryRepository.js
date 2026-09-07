import { db } from '../config/db.js';

export class InventoryRepository {

  static async createMedicine(data) {
    return db.medicine.create({
      data,
      include: { supplier: true }
    });
  }

  static async findMedicineById(medicineId, tenantId) {
    return db.medicine.findFirst({
      where: { medicine_id: medicineId, tenant_id: tenantId, deleted_at: null },
      include: { supplier: true }
    });
  }

  static async findManyPaginated({ tenantId, search, lowStockOnly, skip, take }) {
    const where = { tenant_id: tenantId, deleted_at: null };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { batch_number: { contains: search, mode: 'insensitive' } }
      ];
    }

    return db.$transaction(async (tx) => {
      // Moved $queryRaw INSIDE the transaction so it runs on the RLS-secured connection
      if (lowStockOnly) {
        const lowStockIds = await tx.$queryRaw`
          SELECT medicine_id FROM medicine
          WHERE tenant_id = ${tenantId}::uuid
            AND quantity <= reorder_level
            AND deleted_at IS NULL
        `;
        const mappedIds = Array.isArray(lowStockIds) ? lowStockIds.map(r => r.medicine_id).filter(Boolean) : [];
        where.medicine_id = { in: mappedIds.length > 0 ? mappedIds : ['00000000-0000-0000-0000-000000000000'] };
      }

      const [total, medicines] = await Promise.all([
        tx.medicine.count({ where }),
        tx.medicine.findMany({
          where,
          skip,
          take,
          orderBy: { name: 'asc' },
          include: { supplier: { select: { name: true, contact_phone: true } } }
        })
      ]);
      return { total, medicines };
    });
  }

  /**
   * Atomically adjusts stock and records the movement history.
   * If dispensing, mathematically ensures stock cannot drop below 0.
   */
  static async adjustStockTransaction({ tenantId, medicineId, type, quantity, referenceId, notes }) {
    return db.$transaction(async (tx) => {
      let updateResult;
      const isDeduction = quantity < 0;
      const absQuantity = Math.abs(quantity);

      if (isDeduction) {
        // Atomic guard: only update if quantity >= absQuantity
        updateResult = await tx.medicine.updateMany({
          where: {
            medicine_id: medicineId,
            tenant_id: tenantId,
            deleted_at: null,
            quantity: { gte: absQuantity }
          },
          data: {
            quantity: { decrement: absQuantity }
          }
        });

        if (updateResult.count === 0) {
          throw new Error('INSUFFICIENT_STOCK');
        }
      } else {
        updateResult = await tx.medicine.updateMany({
          where: { medicine_id: medicineId, tenant_id: tenantId, deleted_at: null },
          data: {
            quantity: { increment: absQuantity }
          }
        });

        if (updateResult.count === 0) {
          throw new Error('MEDICINE_NOT_FOUND');
        }
      }

      // Mandatory tracking: stock movement record
      const movement = await tx.stock_movement.create({
        data: {
          tenant_id: tenantId,
          medicine_id: medicineId,
          type, // PURCHASE, DISPENSE, RETURN, ADJUSTMENT, EXPIRED
          quantity, // signed: positive = in, negative = out
          reference_id: referenceId,
          notes
        }
      });

      const updatedMedicine = await tx.medicine.findFirst({
        where: { medicine_id: medicineId, tenant_id: tenantId, deleted_at: null }
      });

      return { medicine: updatedMedicine, movement };
    });
  }
}