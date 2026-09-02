import { PrescriptionTemplateService } from "../services/prescriptionTemplateService.js";
import { HTTP_STATUS } from "../constants/httpStatus.js";

export class PrescriptionTemplateController {
  static async create(req, res, next) {
    try {
      const template = await PrescriptionTemplateService.createTemplate({
        tenantId: req.currentTenantId,
        userId: req.userId,
        ...req.body,
        ipAddress: req.ip,
      });
      res.status(HTTP_STATUS.CREATED).json({ success: true, data: template });
    } catch (error) {
      next(error);
    }
  }

  static async getById(req, res, next) {
    try {
      const template = await PrescriptionTemplateService.getTemplate({
        tenantId: req.currentTenantId,
        templateId: req.params.id,
      });
      res.status(HTTP_STATUS.OK).json({ success: true, data: template });
    } catch (error) {
      next(error);
    }
  }

  static async list(req, res, next) {
    try {
      const result = await PrescriptionTemplateService.listTemplates({
        tenantId: req.currentTenantId,
        query: req.query,
      });
      res.status(HTTP_STATUS.OK).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }

  static async update(req, res, next) {
    try {
      const template = await PrescriptionTemplateService.updateTemplate({
        tenantId: req.currentTenantId,
        userId: req.userId,
        templateId: req.params.id,
        data: req.body,
        ipAddress: req.ip,
      });
      res.status(HTTP_STATUS.OK).json({ success: true, data: template });
    } catch (error) {
      next(error);
    }
  }

  static async remove(req, res, next) {
    try {
      await PrescriptionTemplateService.deleteTemplate({
        tenantId: req.currentTenantId,
        userId: req.userId,
        templateId: req.params.id,
        ipAddress: req.ip,
      });
      res
        .status(HTTP_STATUS.OK)
        .json({ success: true, message: "Template deleted." });
    } catch (error) {
      next(error);
    }
  }
}
