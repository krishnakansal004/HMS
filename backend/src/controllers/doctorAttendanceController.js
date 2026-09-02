import { DoctorAttendanceService } from "../services/doctorAttendanceService.js";
import { HTTP_STATUS } from "../constants/httpStatus.js";

export class DoctorAttendanceController {
  static async checkIn(req, res, next) {
    try {
      const record = await DoctorAttendanceService.checkIn({
        tenantId: req.currentTenantId,
        requestingUserId: req.userId,
        requestingUserRole: req.userRole,
        targetUserId: req.body.targetUserId,
        ipAddress: req.ip,
      });
      res.status(HTTP_STATUS.CREATED).json({ success: true, data: record });
    } catch (error) {
      next(error);
    }
  }

  static async checkOut(req, res, next) {
    try {
      const record = await DoctorAttendanceService.checkOut({
        tenantId: req.currentTenantId,
        requestingUserId: req.userId,
        requestingUserRole: req.userRole,
        targetUserId: req.body.targetUserId,
        ipAddress: req.ip,
      });
      res.status(HTTP_STATUS.OK).json({ success: true, data: record });
    } catch (error) {
      next(error);
    }
  }

  static async setStatus(req, res, next) {
    try {
      const { targetUserId, attendanceDate, status, notes } = req.body;
      const record = await DoctorAttendanceService.setStatus({
        tenantId: req.currentTenantId,
        requestingUserId: req.userId,
        targetUserId,
        attendanceDate,
        status,
        notes,
        ipAddress: req.ip,
      });
      res.status(HTTP_STATUS.OK).json({ success: true, data: record });
    } catch (error) {
      next(error);
    }
  }

  static async list(req, res, next) {
    try {
      const result = await DoctorAttendanceService.listAttendance({
        tenantId: req.currentTenantId,
        requestingUserRole: req.userRole,
        requestingUserId: req.userId,
        query: req.query,
      });
      res.status(HTTP_STATUS.OK).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }
}
