import { DoctorManagementService } from '../services/doctorManagementService.js';

export class DoctorManagementController {
  static async submitApplication(req, res) {
    const app = await DoctorManagementService.submitApplication(req.body);
    res.status(201).json({ success: true, data: app });
  }
  static async reviewApplication(req, res) {
    const app = await DoctorManagementService.reviewApplication({ tenantId: req.currentTenantId, userId: req.userId, applicationId: req.params.id, status: req.body.status, ipAddress: req.ip });
    res.status(200).json({ success: true, data: app });
  }
}