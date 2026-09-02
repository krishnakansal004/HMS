import { db } from '../config/db.js';

export class PrescriptionTemplateRepository {

  static async create({ tenantId, userId, name, medicines, tests, html }) {
    return db.prescription_template.create({
      data: {
        tenant_id: tenantId,
        created_by: userId,
        name,
        medicines: medicines || [],
        tests: tests || [],
        html: html || null
      }
    });
  }

  static async findByIdAndTenant(templateId, tenantId) {
    return db.prescription_template.findFirst({
      where: { template_id: templateId, tenant_id: tenantId, deleted_at: null }
    });
  }

  static async findManyPaginated({ tenantId, search, skip, take }) {
    const where = { tenant_id: tenantId, deleted_at: null };
    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }

    return db.$transaction(async (tx) => {
      const [total, templates] = await Promise.all([
        tx.prescription_template.count({ where }),
        tx.prescription_template.findMany({
          where,
          skip,
          take,
          orderBy: { created_at: 'desc' }
        })
      ]);
      return [total, templates];
    });
  }

  static async update(templateId, tenantId, data) {
    const result = await db.prescription_template.updateMany({
      where: { template_id: templateId, tenant_id: tenantId, deleted_at: null },
      data: { ...data, updated_at: new Date() }
    });
    if (result.count === 0) return null;
    return this.findByIdAndTenant(templateId, tenantId);
  }

  // Soft delete, matching every other deletable entity in this schema
  // (patient/prescription/etc. all use deleted_at rather than a real
  // DELETE) -- keeps template history available for prescriptions already
  // created from it.
  static async softDelete(templateId, tenantId) {
    return db.prescription_template.updateMany({
      where: { template_id: templateId, tenant_id: tenantId, deleted_at: null },
      data: { deleted_at: new Date() }
    });
  }
}
