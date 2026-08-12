import { ClinicalSettingsRepository } from '../repositories/clinicalSettingsRepository.js';
import { AuditService } from './auditService.js';
import { AppError } from '../middlewares/errorHandler.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';

export class ClinicalSettingsService {
  
  static async createPrescriptionTemplate({ tenantId, userId, name, medicines, tests, html, ipAddress }) {
    const template = await ClinicalSettingsRepository.createTemplate(tenantId, userId, {
      name,
      medicines,
      tests,
      html
    });

    AuditService.logAction({
      tenantId,
      userId,
      action: 'CREATE_PRESCRIPTION_TEMPLATE',
      entityType: 'PRESCRIPTION_TEMPLATE',
      entityId: template.template_id,
      newValue: { name },
      ipAddress
    });

    return template;
  }

  static async listTemplates({ tenantId }) {
    return ClinicalSettingsRepository.findTemplates(tenantId);
  }

  static async removeTemplate({ tenantId, userId, templateId, ipAddress }) {
    const template = await ClinicalSettingsRepository.findTemplateById(tenantId, templateId);
    if (!template) {
      throw new AppError('Prescription template not found.', HTTP_STATUS.NOT_FOUND);
    }

    await ClinicalSettingsRepository.deleteTemplate(tenantId, templateId);

    AuditService.logAction({
      tenantId,
      userId,
      action: 'DELETE_PRESCRIPTION_TEMPLATE',
      entityType: 'PRESCRIPTION_TEMPLATE',
      entityId: templateId,
      oldValue: { name: template.name },
      newValue: { deleted_at: new Date() },
      ipAddress
    });

    return { template_id: templateId, deleted: true };
  }

  static async updateSetting({ tenantId, userId, key, value, group, ipAddress }) {
    const setting = await ClinicalSettingsRepository.upsertSetting(tenantId, userId, key, value, group);

    AuditService.logAction({
      tenantId,
      userId,
      action: 'UPDATE_TENANT_SETTING',
      entityType: 'SETTING',
      entityId: setting.setting_id,
      newValue: { key, value, group },
      ipAddress
    });

    return setting;
  }

  static async listSettings({ tenantId }) {
    return ClinicalSettingsRepository.findSettings(tenantId);
  }
}