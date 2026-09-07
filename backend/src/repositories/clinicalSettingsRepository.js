import { db } from "../config/db.js";

export class ClinicalSettingsRepository {
  static async createTemplate(tenantId, userId, data) {
    return db.prescription_template.create({
      data: {
        tenant_id: tenantId,
        created_by: userId,
        name: data.name,
        medicines: JSON.parse(JSON.stringify(data.medicines || [])),
        tests: JSON.parse(JSON.stringify(data.tests || [])),
        html: data.html || null,
      },
    });
  }

  static async findTemplates(tenantId) {
    return db.prescription_template.findMany({
      where: { tenant_id: tenantId, deleted_at: null },
      orderBy: { created_at: "desc" },
      include: {
        users: { select: { name: true } },
      },
    });
  }

  static async findTemplateById(tenantId, templateId) {
    return db.prescription_template.findFirst({
      where: { template_id: templateId, tenant_id: tenantId, deleted_at: null },
    });
  }

  static async deleteTemplate(tenantId, templateId) {
    return db.prescription_template.updateMany({
      where: { template_id: templateId, tenant_id: tenantId, deleted_at: null },
      data: { deleted_at: new Date(), updated_at: new Date() },
    });
  }

  static async upsertSetting(tenantId, userId, key, value, group) {
    return db.setting.upsert({
      where: {
        tenant_id_key: {
          tenant_id: tenantId,
          key: key,
        },
      },
      update: {
        value: String(value),
        group: group || "general",
        updated_by: userId,
        updated_at: new Date(),
      },
      create: {
        tenant_id: tenantId,
        key: key,
        value: String(value),
        group: group || "general",
        updated_by: userId,
      },
    });
  }

  static async findSettings(tenantId) {
    return db.setting.findMany({
      where: { tenant_id: tenantId },
      orderBy: { group: "asc" },
    });
  }
}
