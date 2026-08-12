import { EmergencyService } from '../services/emergencyService.js';

export class EmergencyController {
  static async dispatchAmbulance(req, res) {
    const dispatch = await EmergencyService.dispatchAmbulance({ tenantId: req.currentTenantId, userId: req.userId, ...req.body, ipAddress: req.ip });
    res.status(201).json({ success: true, data: dispatch });
  }
  static async scheduleSurgery(req, res) {
    const surgery = await EmergencyService.scheduleSurgery({ tenantId: req.currentTenantId, userId: req.userId, ...req.body, ipAddress: req.ip });
    res.status(201).json({ success: true, data: surgery });
  }
}