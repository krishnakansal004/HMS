import { ClinicalSettingsService } from '../services/clinicalSettingsService.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';

export class ClinicalSettingsController {
  
  static async createTemplate(req, res, next) {
    try {
      const template = await ClinicalSettingsService.createPrescriptionTemplate({
        tenantId: req.currentTenantId,
        userId: req.userId,
        ...req.body,
        ipAddress: req.ip
      });

      res.status(HTTP_STATUS.CREATED).json({
        success: true,
        message: 'Prescription template created successfully',
        data: template
      });
    } catch (error) {
      next(error);
    }
  }

  static async listTemplates(req, res, next) {
    try {
      const templates = await ClinicalSettingsService.listTemplates({
        tenantId: req.currentTenantId
      });

      res.status(HTTP_STATUS.OK).json({
        success: true,
        data: templates
      });
    } catch (error) {
      next(error);
    }
  }

  static async removeTemplate(req, res, next) {
    try {
      const result = await ClinicalSettingsService.removeTemplate({
        tenantId: req.currentTenantId,
        userId: req.userId,
        templateId: req.params.id,
        ipAddress: req.ip
      });

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Template deleted successfully',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateSetting(req, res, next) {
    try {
      const setting = await ClinicalSettingsService.updateSetting({
        tenantId: req.currentTenantId,
        userId: req.userId,
        ...req.body,
        ipAddress: req.ip
      });

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Setting updated successfully',
        data: setting
      });
    } catch (error) {
      next(error);
    }
  }

  static async listSettings(req, res, next) {
    try {
      const settings = await ClinicalSettingsService.listSettings({
        tenantId: req.currentTenantId
      });

      res.status(HTTP_STATUS.OK).json({
        success: true,
        data: settings
      });
    } catch (error) {
      next(error);
    }
  }
}