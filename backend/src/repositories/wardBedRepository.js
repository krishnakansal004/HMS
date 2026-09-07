import { db } from '../config/db.js';

export class WardBedRepository {
  
  static async createWard(tenantId, data) {
    return db.ward.create({
      data: {
        tenant_id: tenantId,
        ...data
      }
    });
  }

  static async findWards(tenantId) {
    return db.ward.findMany({
      where: { tenant_id: tenantId, deleted_at: null },
      include: {
        // NOTE: no `status` here — bed has no such column, only
        // `is_occupied` (boolean).
        bed: {
          where: { deleted_at: null },
          select: { bed_id: true, bed_number: true, is_occupied: true, price_per_day: true }
        }
      },
      orderBy: { name: 'asc' }
    });
  }

  static async findWardById(tenantId, wardId) {
    return db.ward.findFirst({
      where: { ward_id: wardId, tenant_id: tenantId, deleted_at: null },
      include: { 
        bed: {
          where: { deleted_at: null }
        } 
      }
    });
  }

  static async createBed(tenantId, wardId, bedNumber, pricePerDay) {
    return db.$transaction(async (tx) => {
      // Verify ward capacity limits
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${wardId}::text))`;
      const ward = await tx.ward.findFirst({
        where: { ward_id: wardId, tenant_id: tenantId, deleted_at: null }
      });

      if (!ward) {
        throw new Error('WARD_NOT_FOUND');
      }

      const currentBedsCount = await tx.bed.count({
        where: { ward_id: wardId, tenant_id: tenantId, deleted_at: null }
      });

      if (currentBedsCount >= ward.capacity) {
        throw new Error('WARD_CAPACITY_EXCEEDED');
      }

      // Create Bed
      const bed = await tx.bed.create({
        data: {
          tenant_id: tenantId,
          ward_id: wardId,
          bed_number: bedNumber,
          price_per_day: pricePerDay || ward.price_per_day,
          is_occupied: false
        }
      });

      return bed;
    });
  }

  static async updateBedOccupancyTransaction({ tenantId, bedId, patientId, isOccupied }) {
    return db.$transaction(async (tx) => {
      const bed = await tx.bed.findFirst({
        where: { bed_id: bedId, tenant_id: tenantId, deleted_at: null }
      });

      if (!bed) throw new Error('BED_NOT_FOUND');
      if (isOccupied && bed.is_occupied) throw new Error('BED_ALREADY_OCCUPIED');

      // Update Bed
      const updatedBed = await tx.bed.update({
        where: { bed_id: bedId },
        data: {
          is_occupied: isOccupied,
          patient_id: patientId || null,
          updated_at: new Date()
        }
      });

      // Recalculate ward current occupancy count
      const occupiedCount = await tx.bed.count({
        where: { ward_id: bed.ward_id, tenant_id: tenantId, is_occupied: true, deleted_at: null }
      });

      await tx.ward.update({
        where: { ward_id: bed.ward_id },
        data: { current_occupancy: occupiedCount }
      });

      return updatedBed;
    });
  }
}