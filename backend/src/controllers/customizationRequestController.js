import { CustomizationRequestService } from "../services/customizationRequestService.js";
import { HTTP_STATUS } from "../constants/httpStatus.js";

export class CustomizationRequestController {
  static async submit(req, res, next) {
    try {
      const request = await CustomizationRequestService.submit(req.body);
      res.status(HTTP_STATUS.CREATED).json({ success: true, data: request });
    } catch (error) {
      next(error);
    }
  }

  static async updateStatus(req, res, next) {
    try {
      const updated = await CustomizationRequestService.updateStatus({
        tenantId: req.currentTenantId,
        userId: req.userId,
        requestId: req.params.id,
        status: req.body.status,
        ipAddress: req.ip,
      });
      res.status(HTTP_STATUS.OK).json({ success: true, data: updated });
    } catch (error) {
      next(error);
    }
  }

  static async list(req, res, next) {
    try {
      const result = await CustomizationRequestService.list({
        tenantId: req.currentTenantId,
        query: req.query,
      });
      res.status(HTTP_STATUS.OK).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }
}
