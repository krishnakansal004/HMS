import { AvailabilityRepository } from "../repositories/availabilityRepository.js";
import { AuditService } from "./auditService.js";
import { AppError } from "../middlewares/errorHandler.js";
import { HTTP_STATUS } from "../constants/httpStatus.js";

export class AvailabilityService {
  // Generates a default 9-to-5 schedule if the doctor has never set one up
  static getDefaultSchedule() {
    return [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
      dayOfWeek,
      enabled: dayOfWeek >= 1 && dayOfWeek <= 5, // Mon-Fri enabled by default
      startTime: "09:00",
      endTime: "17:00",
      slotDurationMin: 15,
    }));
  }

  static async getDoctorAvailability({ tenantId, doctorId }) {
    // Validate doctor exists in this tenant
    const doctorExists = await AvailabilityRepository.checkDoctorExists(
      tenantId,
      doctorId,
    );
    if (!doctorExists) {
      throw new AppError(
        "Doctor not found in this hospital.",
        HTTP_STATUS.NOT_FOUND,
      );
    }

    // Fetch availability
    const availability = await AvailabilityRepository.findByDoctor(
      tenantId,
      doctorId,
    );

    // Return existing or default
    if (!availability) {
      return {
        doctor_id: doctorId,
        days: this.getDefaultSchedule(),
        exceptions: [],
      };
    }

    return availability;
  }

  static async updateDoctorAvailability({
    tenantId,
    requestingUserId,
    requestingUserRole,
    doctorId,
    days,
    exceptions,
    ipAddress,
  }) {
    // RBAC Check: Doctors can only edit their own schedule. Admins/Directors can edit anyone's.
    if (requestingUserRole === "DOCTOR" && requestingUserId !== doctorId) {
      throw new AppError(
        "You are only authorized to update your own availability.",
        HTTP_STATUS.FORBIDDEN,
      );
    }

    // Validate doctor exists in this tenant
    const doctorExists = await AvailabilityRepository.checkDoctorExists(
      tenantId,
      doctorId,
    );
    if (!doctorExists) {
      throw new AppError(
        "Doctor not found in this hospital.",
        HTTP_STATUS.NOT_FOUND,
      );
    }

    // Upsert the schedule
    const updatedAvailability = await AvailabilityRepository.upsertAvailability(
      tenantId,
      doctorId,
      days,
      exceptions || [],
    );

    // Audit Logging (Fire and forget)
    AuditService.logAction({
      tenantId,
      userId: requestingUserId,
      action: "UPDATE_DOCTOR_AVAILABILITY",
      entityType: "DOCTOR_AVAILABILITY",
      entityId: updatedAvailability.availability_id,
      newValue: { days, exceptions },
      ipAddress,
    });

    return updatedAvailability;
  }
}
