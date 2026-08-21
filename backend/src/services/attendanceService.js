import { AttendanceRepository } from '../repositories/attendanceRepository.js';
import { AuditService } from './auditService.js';
import { AppError } from '../middlewares/errorHandler.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';

// rewritten against the real `attendance` table/model (see
// migrateSQL/0044_create_attendance_table.sql and
// PRISMA_SCHEMA_ADDITION_attendance.prisma) -- field names are now
// snake_case throughout (tenant_id, user_id, attendance_date, status,
// check_in_at, check_out_at, attendance_id) to match what the fixed
// AttendanceRepository actually returns. Business logic (one record per
// user per day, admin-can-check-in-others) is unchanged.
export class AttendanceService {

  static getNormalizedToday() {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    return today;
  }

  static async checkIn({ tenantId, requestingUserId, targetUserId, ipAddress }) {
    const userId = targetUserId || requestingUserId;
    const today = this.getNormalizedToday();
    const now = new Date();

    const existingRecord = await AttendanceRepository.findByUserAndDate(tenantId, userId, today);
    if (existingRecord) {
      throw new AppError('User has already checked in today.', HTTP_STATUS.CONFLICT);
    }

    const attendance = await AttendanceRepository.create({
      tenant_id: tenantId,
      user_id: userId,
      attendance_date: today,
      check_in_at: now,
      status: 'PRESENT'
    });

    AuditService.logAction({
      tenantId,
      userId: requestingUserId,
      action: 'ATTENDANCE_CHECK_IN',
      entityType: 'ATTENDANCE',
      entityId: attendance.attendance_id,
      newValue: { checkInAt: now, targetUser: userId },
      ipAddress
    });

    return attendance;
  }

  static async checkOut({ tenantId, requestingUserId, targetUserId, ipAddress }) {
    const userId = targetUserId || requestingUserId;
    const today = this.getNormalizedToday();
    const now = new Date();

    const existingRecord = await AttendanceRepository.findByUserAndDate(tenantId, userId, today);
    if (!existingRecord) {
      throw new AppError('No check-in record found for today. Cannot check out.', HTTP_STATUS.BAD_REQUEST);
    }

    if (existingRecord.check_out_at) {
      throw new AppError('User has already checked out today.', HTTP_STATUS.CONFLICT);
    }

    const updatedAttendance = await AttendanceRepository.update(existingRecord.attendance_id, {
      check_out_at: now
    });

    AuditService.logAction({
      tenantId,
      userId: requestingUserId,
      action: 'ATTENDANCE_CHECK_OUT',
      entityType: 'ATTENDANCE',
      entityId: existingRecord.attendance_id,
      oldValue: { checkOutAt: null },
      newValue: { checkOutAt: now, targetUser: userId },
      ipAddress
    });

    return updatedAttendance;
  }

  static async getAttendanceRecords({ tenantId, userRole, requestingUserId, query }) {
    let { userId, startDate, endDate, status, page = 1, limit = 50 } = query;
    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    if (!['HOSPITAL_ADMIN', 'DIRECTOR', 'HR'].includes(userRole)) {
      userId = requestingUserId;
    }

    const [total, records] = await AttendanceRepository.findManyPaginated({
      tenantId, userId, startDate, endDate, status, skip, take
    });

    return {
      total,
      page: Number(page),
      pages: Math.ceil(total / take),
      data: records
    };
  }
}
