import { AppointmentRepository } from "../repositories/appointmentRepository.js";
import { AuditService } from "./auditService.js";
import { AppError } from "../middlewares/errorHandler.js";
import { HTTP_STATUS } from "../constants/httpStatus.js";
import { db } from "../config/db.js";
import { InvoiceRepository } from "../repositories/invoiceRepository.js";
export class AppointmentService {
  static async bookAppointment({
    tenantId,
    userId,
    userRole,
    doctorId,
    patientId,
    startTime,
    endTime,
    type,
    notes,
    ipAddress,
  }) {
    let targetPatientId = patientId;
    let targetDoctorId = doctorId;

    // PATIENT SECURITY: Override any frontend payload with their actual ID
    if (userRole === "PATIENT") {
      const ownPatientRecord = await db.patient.findFirst({
        where: { user_id: userId, tenant_id: tenantId, deleted_at: null },
      });
      if (!ownPatientRecord)
        throw new AppError("Patient profile not found.", HTTP_STATUS.NOT_FOUND);
      targetPatientId = ownPatientRecord.patient_id;
    }

    // DOCTOR SECURITY: Override any frontend payload with their own doctor_profile_id
    if (userRole === "DOCTOR") {
      const doctorProfile = await db.doctor_profile.findFirst({
        where: { user_id: userId, tenant_id: tenantId, deleted_at: null },
        select: { doctor_profile_id: true },
      });
      if (!doctorProfile) {
        throw new AppError("Doctor profile not found.", HTTP_STATUS.NOT_FOUND);
      }
      targetDoctorId = doctorProfile.doctor_profile_id;
    }

    const start = new Date(startTime);
    const end = new Date(endTime);

    if (start >= end)
      throw new AppError(
        "Appointment end time must be after start time.",
        HTTP_STATUS.BAD_REQUEST,
      );
    if (start < new Date())
      throw new AppError(
        "Cannot book appointments in the past.",
        HTTP_STATUS.BAD_REQUEST,
      );

    const overlap = await AppointmentRepository.checkOverlap(
      targetDoctorId,
      start,
      end,
      tenantId,
    );
    if (overlap)
      throw new AppError(
        "The doctor is already booked for this time slot.",
        HTTP_STATUS.CONFLICT,
      );

    const appointment = await AppointmentRepository.create({
      tenantId,
      doctorId: targetDoctorId,
      patientId: targetPatientId,
      date: start,
      startTime: start,
      endTime: end,
      type,
      notes,
      status: "scheduled",
    });

    const doctorProfile = await db.doctor_profile.findFirst({
      where: {
        doctor_profile_id: targetDoctorId,
        tenant_id: tenantId,
        deleted_at: null,
      },
      select: { consultation_fee: true },
    });
    const consultationFee = Number(doctorProfile?.consultation_fee || 0);

    if (consultationFee > 0) {
      await InvoiceRepository.createInvoiceTransaction({
        tenantId,
        patientId: targetPatientId,
        subtotal: Math.round(consultationFee * 100),
        gstTotal: 0,
        total: Math.round(consultationFee * 100),
        status: "pending",
        items: [{
          entityType: "CONSULTATION",
          entityId: appointment.appointment_id,
          sourceKey: `appointment:${appointment.appointment_id}`,
          description: `Consultation with Dr. ${appointment.doctor_name_snapshot}`,
          quantity: 1,
          unitPrice: Math.round(consultationFee * 100),
          gstRate: 0,
        }],
      });
    }

    AuditService.logAction({
      tenantId,
      userId,
      action: "CREATE_APPOINTMENT",
      entityType: "APPOINTMENT",
      entityId: appointment.appointment_id,
      newValue: appointment,
      ipAddress,
    });

    return appointment;
  }

  static async getAppointments({ tenantId, userId, userRole, query }) {
    let { doctorId, patientId, status, date, page = 1, limit = 50 } = query;
    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    // PATIENT ISOLATION ENFORCEMENT
    if (userRole === "PATIENT") {
      const ownPatientRecord = await db.patient.findFirst({
        where: { user_id: userId, tenant_id: tenantId, deleted_at: null },
        select: { patient_id: true },
      });
      if (!ownPatientRecord) {
        return { total: 0, page: Number(page), pages: 0, data: [] };
      }
      patientId = ownPatientRecord.patient_id; // Safe reassignment
    }

    // DOCTOR ISOLATION ENFORCEMENT: A doctor may ONLY view their own appointments
    if (userRole === "DOCTOR") {
      const doctorProfile = await db.doctor_profile.findFirst({
        where: { user_id: userId, tenant_id: tenantId, deleted_at: null },
        select: { doctor_profile_id: true },
      });
      if (!doctorProfile) {
        return { total: 0, page: Number(page), pages: 0, data: [] };
      }
      doctorId = doctorProfile.doctor_profile_id; // Strictly enforce doctor's own profile ID
    }

    const [total, appointments] = await AppointmentRepository.findManyPaginated(
      {
        tenantId,
        doctorId,
        patientId,
        status,
        date,
        skip,
        take,
      },
    );

    return {
      total,
      page: Number(page),
      pages: Math.ceil(total / take),
      data: appointments,
    };
  }

  static async updateAppointmentStatus({
    tenantId,
    userId,
    appointmentId,
    userRole,
    status,
    reason,
    ipAddress,
  }) {
    const appointment = await AppointmentRepository.findByIdAndTenant(
      tenantId,
      appointmentId,
    );
    if (!appointment) {
      throw new AppError("Appointment not found.", HTTP_STATUS.NOT_FOUND);
    }

    if (
      appointment.status === "cancelled" ||
      appointment.status === "completed"
    ) {
      throw new AppError(
        `Cannot update status of a ${appointment.status} appointment.`,
        HTTP_STATUS.BAD_REQUEST,
      );
    }
    if (userRole === "DOCTOR") {
      const doctorProfile = await db.doctor_profile.findFirst({
        where: { user_id: userId, tenant_id: tenantId, deleted_at: null },
      });
      if (!doctorProfile || appointment.doctor_id !== doctorProfile.doctor_profile_id) {
        throw new AppError(
          "Unauthorized to update appointments for another practitioner.",
          HTTP_STATUS.FORBIDDEN,
        );
      }
    }

    const updated = await AppointmentRepository.updateStatus(
      tenantId,
      appointmentId,
      status,
      reason,
    );

    // 4. Audit Logging
    AuditService.logAction({
      tenantId,
      userId,
      action: `UPDATE_APPOINTMENT_STATUS_TO_${status}`,
      entityType: "APPOINTMENT",
      entityId: appointment.appointment_id,
      oldValue: { status: appointment.status },
      newValue: { status: updated.status, reason: updated.reason },
      ipAddress,
    });

    return updated;
  }
}
