import { AttendanceService } from "../services/attendanceService.js";
import { HTTP_STATUS } from "../constants/httpStatus.js";

export class AttendanceController {
  static async checkIn(req, res, next) {
    try {
      const attendance = await AttendanceService.checkIn({
        tenantId: req.currentTenantId,
        requestingUserId: req.userId,
        targetUserId: req.body.targetUserId,
        ipAddress: req.ip,
      });

      res.status(HTTP_STATUS.CREATED).json({
        success: true,
        message: "Successfully checked in.",
        data: attendance,
      });
    } catch (error) {
      next(error);
    }
  }

  static async checkOut(req, res, next) {
    try {
      const attendance = await AttendanceService.checkOut({
        tenantId: req.currentTenantId,
        requestingUserId: req.userId,
        targetUserId: req.body.targetUserId,
        ipAddress: req.ip,
      });

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: "Successfully checked out.",
        data: attendance,
      });
    } catch (error) {
      next(error);
    }
  }

  static async list(req, res, next) {
    try {
      const result = await AttendanceService.getAttendanceRecords({
        tenantId: req.currentTenantId,
        userRole: req.userRole,
        requestingUserId: req.userId,
        query: req.query,
      });

      res.status(HTTP_STATUS.OK).json({
        success: true,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  }
}
