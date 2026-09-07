import { db } from "../config/db.js";
import { AppError } from "../middlewares/errorHandler.js";
import { HTTP_STATUS } from "../constants/httpStatus.js";

export class AppointmentRepository {
  static async create({
    tenantId,
    patientId,
    doctorId,
    slotStart,
    slotEnd,
    startTime,
    endTime,
    status,
    type,
    notes,
  }) {
    const start = new Date(slotStart || startTime);
    const end = new Date(slotEnd || endTime);

    return db.$transaction(async (tx) => {
      // Serialize bookings per doctor within tenant to eliminate concurrency race conditions
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(concat(${tenantId}::text, ${doctorId}::text)))`;

      // Check overlap under lock to guarantee atomic conflict detection
      const overlap = await tx.appointment.findFirst({
        where: {
          tenant_id: tenantId,
          doctor_id: doctorId,
          deleted_at: null,
          status: { notIn: ["cancelled", "rejected"] },
          AND: [
            { slot_start: { lt: end } },
            { slot_end: { gt: start } },
          ],
        },
      });

      if (overlap) {
        throw new AppError(
          "The doctor is already booked for this time slot.",
          HTTP_STATUS.CONFLICT,
        );
      }

      // Explicitly fetch the doctor and user relation.
      // Fail fast with a clear error if the doctor profile doesn't exist.
      const doctorProfile = await tx.doctor_profile.findFirst({
        where: { doctor_profile_id: doctorId, tenant_id: tenantId, deleted_at: null },
        include: {
          users: {
            select: { name: true },
          },
        },
      });

      if (!doctorProfile || !doctorProfile.users?.name) {
        throw new AppError(
          "Valid doctor profile and associated user details are required for appointment creation.",
          HTTP_STATUS.BAD_REQUEST,
        );
      }

      const doctorName = doctorProfile.users.name;

      return tx.appointment.create({
        data: {
          tenant_id: tenantId,
          patient_id: patientId,
          doctor_id: doctorId,
          slot_start: start,
          slot_end: end,
          status: status ? status.toLowerCase() : "scheduled",
          type: type ? type.toLowerCase() : "walk_in",
          notes: notes || null,
          doctor_name_snapshot: doctorName,
        },
      });
    });
  }

  static async findByIdAndTenant(tenantId, appointmentId) {
    return db.appointment.findFirst({
      where: {
        appointment_id: appointmentId,
        tenant_id: tenantId,
        deleted_at: null,
      },
      include: {
        patient: {
          select: {
            first_name: true,
            last_name: true,
          },
        },
      },
    });
  }

  static async findManyPaginated({
    tenantId,
    doctorId,
    patientId,
    status,
    skip,
    take,
  }) {
    const where = { tenant_id: tenantId, deleted_at: null };
    if (doctorId) where.doctor_id = doctorId;
    if (patientId) where.patient_id = patientId;
    if (status) where.status = status;

    const [total, rows] = await db.$transaction(async (tx) => {
      const count = await tx.appointment.count({ where });
      const records = await tx.appointment.findMany({
        where,
        skip,
        take,
        orderBy: { slot_start: "desc" },
        include: {
          patient: {
            select: { first_name: true, last_name: true },
          },
        },
      });
      return [count, records];
    });

    return [total, rows];
  }

  static async updateStatus(tenantId, appointmentId, status, reason) {
    await db.appointment.updateMany({
      where: { appointment_id: appointmentId, tenant_id: tenantId, deleted_at: null },
      data: {
        status: status.toLowerCase(),
        reason: reason || null,
        updated_at: new Date(),
      },
    });

    return db.appointment.findFirst({
      where: { appointment_id: appointmentId, tenant_id: tenantId },
    });
  }

  static async checkOverlap(doctorId, startTime, endTime, tenantId = null) {
    const where = {
      doctor_id: doctorId,
      deleted_at: null,
      status: { notIn: ["cancelled", "rejected"] },
      AND: [
        { slot_start: { lt: new Date(endTime) } },
        { slot_end: { gt: new Date(startTime) } },
      ],
    };
    if (tenantId) where.tenant_id = tenantId;

    return db.appointment.findFirst({ where });
  }
}
