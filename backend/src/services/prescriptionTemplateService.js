import { PrescriptionTemplateRepository } from "../repositories/prescriptionTemplateRepository.js";
import { AuditService } from "./auditService.js";
import { AppError } from "../middlewares/errorHandler.js";
import { HTTP_STATUS } from "../constants/httpStatus.js";

export class PrescriptionTemplateService {
  static async createTemplate({
    tenantId,
    userId,
    name,
    medicines,
    tests,
    html,
    ipAddress,
  }) {
    const template = await PrescriptionTemplateRepository.create({
      tenantId,
      userId,
      name,
      medicines,
      tests,
      html,
    });

    AuditService.logAction({
      tenantId,
      userId,
      action: "CREATE_PRESCRIPTION_TEMPLATE",
      entityType: "PRESCRIPTION_TEMPLATE",
      entityId: template.template_id,
      newValue: { name },
      ipAddress,
    });

    return template;
  }

  static async getTemplate({ tenantId, templateId }) {
    const template = await PrescriptionTemplateRepository.findByIdAndTenant(
      templateId,
      tenantId,
    );
    if (!template)
      throw new AppError(
        "Prescription template not found.",
        HTTP_STATUS.NOT_FOUND,
      );
    return template;
  }

  static async listTemplates({ tenantId, query }) {
    const { search, page = 1, limit = 50 } = query;
    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    const [total, data] =
      await PrescriptionTemplateRepository.findManyPaginated({
        tenantId,
        search,
        skip,
        take,
      });

    return { total, page: Number(page), pages: Math.ceil(total / take), data };
  }

  static async updateTemplate({
    tenantId,
    userId,
    templateId,
    data,
    ipAddress,
  }) {
    const updated = await PrescriptionTemplateRepository.update(
      templateId,
      tenantId,
      data,
    );
    if (!updated)
      throw new AppError(
        "Prescription template not found.",
        HTTP_STATUS.NOT_FOUND,
      );

    AuditService.logAction({
      tenantId,
      userId,
      action: "UPDATE_PRESCRIPTION_TEMPLATE",
      entityType: "PRESCRIPTION_TEMPLATE",
      entityId: templateId,
      newValue: data,
      ipAddress,
    });

    return updated;
  }

  static async deleteTemplate({ tenantId, userId, templateId, ipAddress }) {
    const result = await PrescriptionTemplateRepository.softDelete(
      templateId,
      tenantId,
    );
    if (result.count === 0)
      throw new AppError(
        "Prescription template not found.",
        HTTP_STATUS.NOT_FOUND,
      );

    AuditService.logAction({
      tenantId,
      userId,
      action: "DELETE_PRESCRIPTION_TEMPLATE",
      entityType: "PRESCRIPTION_TEMPLATE",
      entityId: templateId,
      ipAddress,
    });

    return { success: true };
  }
}
