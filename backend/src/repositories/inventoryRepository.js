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
      where: { medicine_id: medicineId, tenant_id: tenantId },
      include: { supplier: true }
    });
  }

  static async findManyPaginated({ tenantId, search, lowStockOnly, skip, take }) {
    const where = { tenant_id: tenantId };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { batch_number: { contains: search, mode: 'insensitive' } }
      ];
    }

    // Vanilla Prisma's `where` doesn't support comparing two columns of the
    // same row (there's no `db.medicine.fields.x` runtime API — that was
    // silently doing nothing). Field-to-field comparison needs raw SQL.
    if (lowStockOnly) {
      const lowStockIds = await db.$queryRaw`
        SELECT medicine_id FROM medicine
        WHERE tenant_id = ${tenantId}::uuid
          AND quantity <= reorder_level
          AND deleted_at IS NULL
      `;
      where.medicine_id = { in: lowStockIds.map(r => r.medicine_id) };
    }

    return db.$transaction(async (tx) => {
      const [total, medicines] = await Promise.all([
        tx.medicine.count({ where }),
        tx.medicine.findMany({
          where,
          skip,
          take,
          orderBy: { name: 'asc' },
          include: { supplier: { select: { name: true, phone: true } } }
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
          where: { medicine_id: medicineId, tenant_id: tenantId },
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
        where: { medicine_id: medicineId }
      });

      return { medicine: updatedMedicine, movement };
    });
  }
}