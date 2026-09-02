import { AnalyticsService } from "../services/analyticsService.js";
import { HTTP_STATUS } from "../constants/httpStatus.js";

export class AnalyticsController {
  static async getDashboardStats(req, res, next) {
    try {
      const stats = await AnalyticsService.getDirectorDashboardStats(
        req.currentTenantId,
      );
      res.status(HTTP_STATUS.OK).json({ success: true, data: stats });
    } catch (error) {
      next(error);
    }
  }
}
