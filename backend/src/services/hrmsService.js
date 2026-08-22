import { db } from '../config/db.js';
import { AuditService } from './auditService.js';
import { AppError } from '../middlewares/errorHandler.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';

export class HrmsService {
  
  // SHIFTS
  static async createShift({ tenantId, userId, name, startTime, endTime, ipAddress }) {
    const shift = await db.shift.create({
      data: { tenant_id: tenantId, name, start_time: startTime, end_time: endTime }
    });

    AuditService.logAction({ tenantId, userId, action: 'CREATE_SHIFT', entityType: 'SHIFT', entityId: shift.shift_id, newValue: { name }, ipAddress });
    return shift;
  }

  // LEAVES 
  static async applyLeave({ tenantId, userId, targetUserId, startDate, endDate, reason, ipAddress }) {
    const applicantId = targetUserId || userId;
    const leave = await db.leave.create({
      data: {
        tenant_id: tenantId,
        user_id: applicantId,
        start_date: new Date(startDate),
        end_date: new Date(endDate),
        reason,
        status: 'PENDING'
      }
    });

    AuditService.logAction({ tenantId, userId, action: 'APPLY_LEAVE', entityType: 'LEAVE', entityId: leave.leave_id, newValue: { applicantId, startDate, endDate }, ipAddress });
    return leave;
  }

  static async reviewLeave({ tenantId, userId, leaveId, status, ipAddress }) {
    const leave = await db.leave.findFirst({ where: { leave_id: leaveId, tenant_id: tenantId } });
    if (!leave) throw new AppError('Leave request not found.', HTTP_STATUS.NOT_FOUND);

    const updated = await db.leave.update({
      where: { leave_id: leaveId },
      data: { status, updated_at: new Date() }
    });

    AuditService.logAction({ tenantId, userId, action: `REVIEW_LEAVE_${status}`, entityType: 'LEAVE', entityId: leaveId, newValue: { status }, ipAddress });
    return updated;
  }

  // STAFF DIRECTORY
  static async listStaff({ tenantId, query }) {
    const { search, roleId, page = 1, limit = 50 } = query;
    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    const where = { tenant_id: tenantId, deleted_at: null };
    if (roleId) where.role_id = roleId;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } }
      ];
    }

    
    return db.$transaction(async (tx) => {
      const [total, staff] = await Promise.all([
        tx.users.count({ where }),
        tx.users.findMany({
          where,
          skip,
          take,
          select: { user_id: true, name: true, email: true, role: { select: { name: true } }, created_at: true }
        })
      ]);
      return [total, staff];
    });
  }
}