import { db } from '../config/db.js';

export class DoctorAttendanceRepository {

  // doctor_attendance.doctor_id is FK'd to doctor_profile.doctor_profile_id
  static async resolveDoctorProfileId(tenantId, userId) {
    const profile = await db.doctor_profile.findFirst({
      where: { user_id: userId, tenant_id: tenantId }
    });
    return profile?.doctor_profile_id || null;
  }

  static async findByDoctorAndDate(tenantId, doctorProfileId, attendanceDate) {
    return db.doctor_attendance.findFirst({
      where: {
        tenant_id: tenantId,
        doctor_id: doctorProfileId,
        attendance_date: attendanceDate
      }
    });
  }

  static async upsert({ tenantId, doctorProfileId, attendanceDate, status, checkInAt, checkOutAt, notes }) {
    return db.doctor_attendance.upsert({
      where: {
        doctor_id_attendance_date: {
          doctor_id: doctorProfileId,
          attendance_date: attendanceDate
        }
      },
      update: {
        status,
        ...(checkInAt !== undefined && { check_in_at: checkInAt }),
        ...(checkOutAt !== undefined && { check_out_at: checkOutAt }),
        ...(notes !== undefined && { notes }),
        updated_at: new Date()
      },
      create: {
        tenant_id: tenantId,
        doctor_id: doctorProfileId,
        attendance_date: attendanceDate,
        status,
        check_in_at: checkInAt || null,
        check_out_at: checkOutAt || null,
        notes: notes || null
      }
    });
  }

  static async findManyPaginated({ tenantId, doctorProfileId, startDate, endDate, status, skip, take }) {
    const where = { tenant_id: tenantId };
    if (doctorProfileId) where.doctor_id = doctorProfileId;
    if (status) where.status = status;
    if (startDate || endDate) {
      where.attendance_date = {};
      if (startDate) where.attendance_date.gte = new Date(startDate);
      if (endDate) where.attendance_date.lte = new Date(endDate);
    }

    return db.$transaction(async (tx) => {
      const [total, records] = await Promise.all([
        tx.doctor_attendance.count({ where }),
        tx.doctor_attendance.findMany({
          where,
          skip,
          take,
          orderBy: { attendance_date: 'desc' },
          include: {
            doctor_profile: { include: { users: { select: { name: true } } } }
          }
        })
      ]);
      return [total, records];
    });
  }
}
