import { HrmsService } from "../services/hrmsService.js";

export class HrmsController {
  static async createShift(req, res, next) {
    try {
      const { name, startTime, endTime } = req.body;
      const shift = await HrmsService.createShift({
        tenantId: req.currentTenantId,
        userId: req.userId,
        name,
        startTime,
        endTime,
        ipAddress: req.ip,
      });
      res.status(201).json({ success: true, data: shift });
    } catch (error) {
      next(error);
    }
  }

  static async applyLeave(req, res, next) {
    try {
      const { startDate, endDate, reason, targetUserId } = req.body;
      // Only HOSPITAL_ADMIN/HR can file leave on someone else's behalf --
      // everyone else can only apply for themselves, regardless of what
      // targetUserId they send. Mirrors the same
      // only-privileged-roles-can-act-on-others pattern AttendanceService
      // already uses for checkIn/checkOut.
      const canActForOthers = ["HOSPITAL_ADMIN", "HR"].includes(req.userRole);
      const leave = await HrmsService.applyLeave({
        tenantId: req.currentTenantId,
        userId: req.userId,
        targetUserId: canActForOthers ? targetUserId : undefined,
        startDate,
        endDate,
        reason,
        ipAddress: req.ip,
      });
      res.status(201).json({ success: true, data: leave });
    } catch (error) {
      next(error);
    }
  }

  static async reviewLeave(req, res, next) {
    try {
      const { status } = req.body;
      const leave = await HrmsService.reviewLeave({
        tenantId: req.currentTenantId,
        userId: req.userId,
        leaveId: req.params.id,
        status,
        ipAddress: req.ip,
      });
      res.status(200).json({ success: true, data: leave });
    } catch (error) {
      next(error);
    }
  }

  static async listStaff(req, res, next) {
    try {
      const [total, data] = await HrmsService.listStaff({
        tenantId: req.currentTenantId,
        query: req.query,
      });
      const { page = 1, limit = 50 } = req.query;
      res.status(200).json({
        success: true,
        total,
        page: Number(page),
        pages: Math.ceil(total / Number(limit)),
        data,
      });
    } catch (error) {
      next(error);
    }
  }
}
