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
    const start = slotStart || startTime;
    const end = slotEnd || endTime;

    // Explicitly fetch the doctor and user relation.
    // Fail fast with a clear error if the doctor profile doesn't exist.
    const doctorProfile = await db.doctor_profile.findUnique({
      where: { doctor_profile_id: doctorId },
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

    return db.appointment.create({
      data: {
        tenant_id: tenantId,
        patient_id: patientId,
        doctor_id: doctorId,
        slot_start: new Date(start),
        slot_end: new Date(end),
        status: status ? status.toLowerCase() : "scheduled",
        type: type ? type.toLowerCase() : "walk_in",
        notes: notes || null,
        doctor_name_snapshot: doctorName,
      },
    });
  }

  static async findByIdAndTenant(tenantId, appointmentId) {
    return db.appointment.findFirst({
      where: {
        appointment_id: appointmentId,
        tenant_id: tenantId,
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
    const where = { tenant_id: tenantId };
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
    return db.appointment.update({
      where: { appointment_id: appointmentId },
      data: {
        status: status.toLowerCase(),
        reason: reason || null,
        updated_at: new Date(),
      },
    });
  }

  static async checkOverlap(doctorId, startTime, endTime) {
    return db.appointment.findFirst({
      where: {
        doctor_id: doctorId,
        status: { not: "cancelled" },
        AND: [
          { slot_start: { lt: new Date(endTime) } },
          { slot_end: { gt: new Date(startTime) } },
        ],
      },
    });
  }
}
