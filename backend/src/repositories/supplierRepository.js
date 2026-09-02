import { db } from '../config/db.js';

export class SupplierRepository {
  static async create(tenantId, data) {
    return db.supplier.create({
      data: { tenant_id: tenantId, ...data }
    });
  }

  static async update(tenantId, supplierId, data) {
    return db.supplier.updateMany({
      where: { supplier_id: supplierId, tenant_id: tenantId, deleted_at: null },
      data: { ...data, updated_at: new Date() }
    });
  }

  static async softDelete(tenantId, supplierId) {
    return db.supplier.updateMany({
      where: { supplier_id: supplierId, tenant_id: tenantId, deleted_at: null },
      data: { deleted_at: new Date(), updated_at: new Date() }
    });
  }

  static async findMany(tenantId) {
    return db.supplier.findMany({
      where: { tenant_id: tenantId, deleted_at: null },
      orderBy: { name: 'asc' },
      select: { supplier_id: true, name: true, contact_email: true, contact_phone: true }
    });
  }

  static async findById(tenantId, supplierId) {
    return db.supplier.findFirst({
      where: { supplier_id: supplierId, tenant_id: tenantId, deleted_at: null }
    });
  }
}