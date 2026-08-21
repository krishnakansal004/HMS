import { db } from '../config/db.js';


export class AttendanceRepository {

  static async findByUserAndDate(tenantId, userId, attendanceDate) {
    return db.attendance.findUnique({
      where: {
        user_id_attendance_date: {
          user_id: userId,
          attendance_date: attendanceDate
        },
        tenant_id: tenantId
      }
    });
  }

  static async findByIdAndTenant(attendanceId, tenantId) {
    return db.attendance.findFirst({
      where: { attendance_id: attendanceId, tenant_id: tenantId }
    });
  }

  static async create(data) {
    return db.attendance.create({
      data,
      include: {
        users: { select: { name: true, email: true } }
      }
    });
  }

  static async update(attendanceId, data) {
    return db.attendance.update({
      where: { attendance_id: attendanceId },
      data,
      include: {
        users: { select: { name: true, email: true } }
      }
    });
  }

  static async findManyPaginated({ tenantId, userId, startDate, endDate, status, skip, take }) {
    const where = { tenant_id: tenantId };

    if (userId) where.user_id = userId;
    if (status) where.status = status;

    if (startDate || endDate) {
      where.attendance_date = {};
      if (startDate) where.attendance_date.gte = new Date(startDate);
      if (endDate) where.attendance_date.lte = new Date(endDate);
    }

    return db.$transaction(async (tx) => {
      const [total, records] = await Promise.all([
        tx.attendance.count({ where }),
        tx.attendance.findMany({
          where,
          skip,
          take,
          orderBy: [{ attendance_date: 'desc' }, { check_in_at: 'desc' }],
          include: {
            users: { select: { name: true, email: true } }
          }
        })
      ]);
      return [total, records];
    });
  }
}
