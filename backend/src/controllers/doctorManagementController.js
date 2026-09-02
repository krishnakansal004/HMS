import { DoctorManagementService } from "../services/doctorManagementService.js";

export class DoctorManagementController {
  static async submitApplication(req, res, next) {
    try {
      const app = await DoctorManagementService.submitApplication(req.body);
      res.status(201).json({ success: true, data: app });
    } catch (error) {
      next(error);
    }
  }

  static async reviewApplication(req, res, next) {
    try {
      const app = await DoctorManagementService.reviewApplication({
        tenantId: req.currentTenantId,
        userId: req.userId,
        applicationId: req.params.id,
        status: req.body.status,
        ipAddress: req.ip,
      });
      res.status(200).json({ success: true, data: app });
    } catch (error) {
      next(error);
    }
  }

  static async list(req, res, next) {
    try {
      const result = await DoctorManagementService.listApplications({
        tenantId: req.currentTenantId,
        query: req.query,
      });
      res.status(200).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }
}
