import { AnalyticsService } from "../services/analyticsService.js";
import { HTTP_STATUS } from "../constants/httpStatus.js";
import { queryAcrossTenants } from "../config/systemOwnerRawClient.js";
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

  static async getPlatformStats(req, res, next) {
    try {
      const stats = await AnalyticsService.getPlatformStats();
      res.status(HTTP_STATUS.OK).json({ success: true, data: stats });
    } catch (error) {
      next(error);
    }
  }
}
