import { EmergencyService } from '../services/emergencyService.js';

export class EmergencyController {
  static async dispatchAmbulance(req, res, next) {
    try {
      const dispatch = await EmergencyService.dispatchAmbulance({
        tenantId: req.currentTenantId,
        userId: req.userId,
        ...req.body,
        ipAddress: req.ip
      });
      res.status(201).json({ success: true, data: dispatch });
    } catch (error) {
      next(error);
    }
  }

  static async scheduleSurgery(req, res, next) {
    try {
      const surgery = await EmergencyService.scheduleSurgery({
        tenantId: req.currentTenantId,
        userId: req.userId,
        ...req.body,
        ipAddress: req.ip
      });
      res.status(201).json({ success: true, data: surgery });
    } catch (error) {
      next(error);
    }
  }
}
