import { db } from '../config/db.js';

export class HrmsRepository {
  static async updateLeaveStatus(tenantId, leaveId, status) {
    return db.leave.update({
      where: { leave_id: leaveId, tenant_id: tenantId },
      data: { status, updated_at: new Date() }
    });
  }
}