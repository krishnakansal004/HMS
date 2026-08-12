// import { db } from '../config/db.js';

// export class AppointmentRepository {

//   static async create({ tenantId, patientId, doctorId, slotStart, slotEnd, status, notes }) {
//     const rows = await db`
//       INSERT INTO appointment (
//         tenant_id, patient_id, doctor_id, slot_start, slot_end, status, notes, created_at, updated_at
//       ) VALUES (
//         ${tenantId}, ${patientId}, ${doctorId}, ${slotStart}, ${slotEnd}, ${status || 'SCHEDULED'}, ${notes || null}, NOW(), NOW()
//       )
//       RETURNING *;
//     `;
//     return rows[0];
//   }

//   static async findByIdAndTenant(tenantId, appointmentId) {
//     const rows = await db`
//       SELECT a.*, 
//              p.first_name AS patient_first_name, p.last_name AS patient_last_name, p.mrn AS patient_mrn,
//              u.name AS doctor_name
//       FROM appointment a
//       LEFT JOIN patient p ON a.patient_id = p.patient_id
//       LEFT JOIN users u ON a.doctor_id = u.user_id
//       WHERE a.appointment_id = ${appointmentId} AND a.tenant_id = ${tenantId};
//     `;
//     return rows[0] || null;
//   }

//   static async findManyPaginated({ tenantId, doctorId, patientId, status, skip, take }) {
//     // 1. Get total count with optional filters
//     const countResult = await db`
//       SELECT COUNT(*) as count FROM appointment 
//       WHERE tenant_id = ${tenantId}
//       AND (${doctorId || null}::uuid IS NULL OR doctor_id = ${doctorId || null})
//       AND (${patientId || null}::uuid IS NULL OR patient_id = ${patientId || null})
//       AND (${status || null}::text IS NULL OR status = ${status || null});
//     `;
//     const total = Number(countResult[0].count);

//     // 2. Fetch paginated rows with joins for patient & doctor details
//     const rows = await db`
//       SELECT a.*, 
//              p.first_name AS patient_first_name, p.last_name AS patient_last_name,
//              u.name AS doctor_name
//       FROM appointment a
//       LEFT JOIN patient p ON a.patient_id = p.patient_id
//       LEFT JOIN users u ON a.doctor_id = u.user_id
//       WHERE a.tenant_id = ${tenantId}
//       AND (${doctorId || null}::uuid IS NULL OR a.doctor_id = ${doctorId || null})
//       AND (${patientId || null}::uuid IS NULL OR a.patient_id = ${patientId || null})
//       AND (${status || null}::text IS NULL OR a.status = ${status || null})
//       ORDER BY a.slot_start DESC
//       LIMIT ${take} OFFSET ${skip};
//     `;

//     return [total, rows];
//   }

//   static async updateStatus(tenantId, appointmentId, status) {
//     const rows = await db`
//       UPDATE appointment 
//       SET status = ${status}, updated_at = NOW()
//       WHERE appointment_id = ${appointmentId} AND tenant_id = ${tenantId}
//       RETURNING *;
//     `;
//     return rows[0] || null;
//   }

//   static async checkOverlap(doctorId, startTime, endTime) {
//     return prisma.appointment.findFirst({
//       where: {
//         doctor_id: doctorId,
//         status: { not: 'CANCELLED' },
//         AND: [
//           { start_time: { lt: endTime } },
//           { end_time: { gt: startTime } }
//         ]
//       }
//     });
//   }
// }


import { prisma } from '../config/db.js';
import { AppError } from '../middlewares/errorHandler.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';

export class AppointmentRepository {

  static async create({ tenantId, patientId, doctorId, slotStart, slotEnd, startTime, endTime, status, notes }) {
    const start = slotStart || startTime;
    const end = slotEnd || endTime;

    // Production-level approach: Explicitly fetch the doctor and user relation.
    // Fail fast with a clear error if the doctor profile doesn't exist.
    const doctorProfile = await prisma.doctor_profile.findUnique({
      where: { doctor_profile_id: doctorId },
      include: { 
        users: { 
          select: { name: true } 
        } 
      }
    });

    if (!doctorProfile || !doctorProfile.users?.name) {
      throw new AppError('Valid doctor profile and associated user details are required for appointment creation.', HTTP_STATUS.BAD_REQUEST);
    }

    const doctorName = doctorProfile.users.name;

    return prisma.appointment.create({
      data: {
        tenant_id: tenantId,
        patient_id: patientId,
        doctor_id: doctorId,
        slot_start: new Date(start),
        slot_end: new Date(end),
        status: status ? status.toLowerCase() : 'scheduled',
        notes: notes || null,
        doctor_name_snapshot: doctorName
      }
    });
  }

  static async findByIdAndTenant(tenantId, appointmentId) {
    return prisma.appointment.findFirst({
      where: {
        appointment_id: appointmentId,
        tenant_id: tenantId
      },
      include: {
        patient: {
          select: {
            first_name: true,
            last_name: true
          }
        }
      }
    });
  }

  static async findManyPaginated({ tenantId, doctorId, patientId, status, skip, take }) {
    const where = { tenant_id: tenantId };
    if (doctorId) where.doctor_id = doctorId;
    if (patientId) where.patient_id = patientId;
    if (status) where.status = status;

    const [total, rows] = await Promise.all([
      prisma.appointment.count({ where }),
      prisma.appointment.findMany({
        where,
        skip,
        take,
        orderBy: { slot_start: 'desc' },
        include: {
          patient: {
            select: { first_name: true, last_name: true }
          }
        }
      })
    ]);

    return [total, rows];
  }

  static async updateStatus(tenantId, appointmentId, status) {
    return prisma.appointment.update({
      where: { appointment_id: appointmentId },
      data: {
        status,
        updated_at: new Date()
      }
    });
  }

  static async checkOverlap(doctorId, startTime, endTime) {
    return prisma.appointment.findFirst({
      where: {
        doctor_id: doctorId,
        status: { not: 'CANCELLED' },
        AND: [
          { slot_start: { lt: new Date(endTime) } },
          { slot_end: { gt: new Date(startTime) } }
        ]
      }
    });
  }
}