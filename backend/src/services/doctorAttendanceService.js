import { DoctorAttendanceRepository } from "../repositories/doctorAttendanceRepository.js";
import { AuditService } from "./auditService.js";
import { AppError } from "../middlewares/errorHandler.js";
import { HTTP_STATUS } from "../constants/httpStatus.js";

function todayDateOnly() {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export class DoctorAttendanceService {
  static async checkIn({
    tenantId,
    requestingUserId,
    requestingUserRole,
    targetUserId,
    ipAddress,
  }) {
    const doctorUserId = this.resolveTargetUser(
      requestingUserId,
      requestingUserRole,
      targetUserId,
    );
    const doctorProfileId =
      await DoctorAttendanceRepository.resolveDoctorProfileId(
        tenantId,
        doctorUserId,
      );
    if (!doctorProfileId)
      throw new AppError(
        "Doctor profile not found in this hospital.",
        HTTP_STATUS.NOT_FOUND,
      );

    const today = todayDateOnly();
    const existing = await DoctorAttendanceRepository.findByDoctorAndDate(
      tenantId,
      doctorProfileId,
      today,
    );
    if (existing?.check_in_at) {
      throw new AppError(
        "This doctor has already checked in today.",
        HTTP_STATUS.CONFLICT,
      );
    }

    const record = await DoctorAttendanceRepository.upsert({
      tenantId,
      doctorProfileId,
      attendanceDate: today,
      status: "present",
      checkInAt: new Date(),
    });

    AuditService.logAction({
      tenantId,
      userId: requestingUserId,
      action: "DOCTOR_ATTENDANCE_CHECK_IN",
      entityType: "DOCTOR_ATTENDANCE",
      entityId: record.doctor_attendance_id,
      newValue: { targetUser: doctorUserId },
      ipAddress,
    });

    return record;
  }

  static async checkOut({
    tenantId,
    requestingUserId,
    requestingUserRole,
    targetUserId,
    ipAddress,
  }) {
    const doctorUserId = this.resolveTargetUser(
      requestingUserId,
      requestingUserRole,
      targetUserId,
    );
    const doctorProfileId =
      await DoctorAttendanceRepository.resolveDoctorProfileId(
        tenantId,
        doctorUserId,
      );
    if (!doctorProfileId)
      throw new AppError(
        "Doctor profile not found in this hospital.",
        HTTP_STATUS.NOT_FOUND,
      );

    const today = todayDateOnly();
    const existing = await DoctorAttendanceRepository.findByDoctorAndDate(
      tenantId,
      doctorProfileId,
      today,
    );
    if (!existing?.check_in_at) {
      throw new AppError(
        "No check-in record found for today. Cannot check out.",
        HTTP_STATUS.BAD_REQUEST,
      );
    }
    if (existing.check_out_at) {
      throw new AppError(
        "This doctor has already checked out today.",
        HTTP_STATUS.CONFLICT,
      );
    }

    const record = await DoctorAttendanceRepository.upsert({
      tenantId,
      doctorProfileId,
      attendanceDate: today,
      status: existing.status,
      checkOutAt: new Date(),
    });

    AuditService.logAction({
      tenantId,
      userId: requestingUserId,
      action: "DOCTOR_ATTENDANCE_CHECK_OUT",
      entityType: "DOCTOR_ATTENDANCE",
      entityId: record.doctor_attendance_id,
      newValue: { targetUser: doctorUserId },
      ipAddress,
    });

    return record;
  }

  // Marks a doctor absent/half_day/on_leave for a given date -- distinct
  // from check-in/out, which only ever set status to 'present'. Only
  // HOSPITAL_ADMIN/HR can do this (a doctor can't mark themselves absent
  // through this endpoint -- that's what leave requests, via the HRMS
  // module, are for).
  static async setStatus({
    tenantId,
    requestingUserId,
    targetUserId,
    attendanceDate,
    status,
    notes,
    ipAddress,
  }) {
    const doctorProfileId =
      await DoctorAttendanceRepository.resolveDoctorProfileId(
        tenantId,
        targetUserId,
      );
    if (!doctorProfileId)
      throw new AppError(
        "Doctor profile not found in this hospital.",
        HTTP_STATUS.NOT_FOUND,
      );

    const record = await DoctorAttendanceRepository.upsert({
      tenantId,
      doctorProfileId,
      attendanceDate: new Date(attendanceDate),
      status,
      notes,
    });

    AuditService.logAction({
      tenantId,
      userId: requestingUserId,
      action: "DOCTOR_ATTENDANCE_SET_STATUS",
      entityType: "DOCTOR_ATTENDANCE",
      entityId: record.doctor_attendance_id,
      newValue: { targetUser: targetUserId, status, attendanceDate },
      ipAddress,
    });

    return record;
  }

  static async listAttendance({
    tenantId,
    requestingUserRole,
    requestingUserId,
    query,
  }) {
    let {
      doctorUserId,
      startDate,
      endDate,
      status,
      page = 1,
      limit = 50,
    } = query;
    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    // A DOCTOR can only ever see their own attendance history -- same
    // pattern AttendanceService (the generic staff module) already uses.
    let doctorProfileId;
    if (requestingUserRole === "DOCTOR") {
      doctorProfileId = await DoctorAttendanceRepository.resolveDoctorProfileId(
        tenantId,
        requestingUserId,
      );
    } else if (doctorUserId) {
      doctorProfileId = await DoctorAttendanceRepository.resolveDoctorProfileId(
        tenantId,
        doctorUserId,
      );
    }

    const [total, records] = await DoctorAttendanceRepository.findManyPaginated(
      {
        tenantId,
        doctorProfileId,
        startDate,
        endDate,
        status,
        skip,
        take,
      },
    );

    return {
      total,
      page: Number(page),
      pages: Math.ceil(total / take),
      data: records,
    };
  }

  // Only HOSPITAL_ADMIN/HR can check in/out or set status for a doctor
  // other than themselves -- mirrors AttendanceService's existing rule for
  // the generic staff attendance module rather than inventing a different
  // policy for this one.
  static resolveTargetUser(requestingUserId, requestingUserRole, targetUserId) {
    if (targetUserId && targetUserId !== requestingUserId) {
      if (!["HOSPITAL_ADMIN", "HR"].includes(requestingUserRole)) {
        throw new AppError(
          "You are not authorized to record attendance for another doctor.",
          HTTP_STATUS.FORBIDDEN,
        );
      }
      return targetUserId;
    }
    return requestingUserId;
  }
}
