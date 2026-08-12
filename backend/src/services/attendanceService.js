import { AttendanceRepository } from '../repositories/attendanceRepository.js';
import { AuditService } from './auditService.js';
import { AppError } from '../middlewares/errorHandler.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';

export class AttendanceService {
  
  // Normalizes a Date object to exactly 00:00:00 UTC to ensure unique constraints work perfectly
  static getNormalizedToday() {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    return today;
  }

  static async checkIn({ tenantId, requestingUserId, targetUserId, ipAddress }) {
    // If targetUserId is provided (Admin checking someone else in), use it. Otherwise, use requester.
    const userId = targetUserId || requestingUserId;
    const today = this.getNormalizedToday();
    const now = new Date();

    // 1. Business Rule: User can only have one attendance record per day
    const existingRecord = await AttendanceRepository.findByUserAndDate(tenantId, userId, today);
    if (existingRecord) {
      throw new AppError('User has already checked in today.', HTTP_STATUS.CONFLICT);
    }

    // 2. Create Check-In Record
    const attendance = await AttendanceRepository.create({
      tenantId,
      userId,
      date: today,
      checkIn: now,
      status: 'PRESENT'
    });

    // 3. Audit Logging
    AuditService.logAction({
      tenantId,
      userId: requestingUserId, // The person who performed the action
      action: 'ATTENDANCE_CHECK_IN',
      entityType: 'ATTENDANCE',
      entityId: attendance.id,
      newValue: { checkIn: now, targetUser: userId },
      ipAddress
    });

    return attendance;
  }

  static async checkOut({ tenantId, requestingUserId, targetUserId, ipAddress }) {
    const userId = targetUserId || requestingUserId;
    const today = this.getNormalizedToday();
    const now = new Date();

    // 1. Find today's record
    const existingRecord = await AttendanceRepository.findByUserAndDate(tenantId, userId, today);
    if (!existingRecord) {
      throw new AppError('No check-in record found for today. Cannot check out.', HTTP_STATUS.BAD_REQUEST);
    }

    // 2. Business Rule: Cannot check out twice
    if (existingRecord.checkOut) {
      throw new AppError('User has already checked out today.', HTTP_STATUS.CONFLICT);
    }

    // 3. Perform Check-Out
    const updatedAttendance = await AttendanceRepository.update(existingRecord.id, {
      checkOut: now
    });

    // 4. Audit Logging
    AuditService.logAction({
      tenantId,
      userId: requestingUserId,
      action: 'ATTENDANCE_CHECK_OUT',
      entityType: 'ATTENDANCE',
      entityId: existingRecord.id,
      oldValue: { checkOut: null },
      newValue: { checkOut: now, targetUser: userId },
      ipAddress
    });

    return updatedAttendance;
  }

  static async getAttendanceRecords({ tenantId, userRole, requestingUserId, query }) {
    let { userId, startDate, endDate, status, page = 1, limit = 50 } = query;
    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    // 1. RBAC Data Scoping: 
    // Regular staff/doctors can ONLY see their own attendance.
    // Admins/Directors/HR can see everyone's (or filter by a specific userId).
    if (!['HOSPITAL_ADMIN', 'DIRECTOR', 'HR'].includes(userRole)) {
      userId = requestingUserId; // Force filter to their own ID
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