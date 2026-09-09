import { QueryService } from "../services/queryService.js";
import { HTTP_STATUS } from "../constants/httpStatus.js";

export class QueryController {
  // Public, no auth -- the marketing-site contact form.
  static async submit(req, res, next) {
    try {
      const { tenantId, name, email, phone, message } = req.body;
      const query = await QueryService.submit({
        tenantId,
        name,
        email,
        phone,
        message,
      });
      res.status(HTTP_STATUS.CREATED).json({ success: true, data: query });
    } catch (error) {
      next(error);
    }
  }

  static async updateStatus(req, res, next) {
    try {
      const updated = await QueryService.updateStatus({
        tenantId: req.currentTenantId,
        userId: req.userId,
        queryId: req.params.id,
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
      const result = await QueryService.list({
        tenantId: req.currentTenantId,
        query: req.query,
      });
      res.status(HTTP_STATUS.OK).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }

  static async listUnassigned(req, res, next) {
    try {
      const result = await QueryService.listUnassignedLeads({
        userRole: req.userRole,
        query: req.query,
      });
      res.status(HTTP_STATUS.OK).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }
}
