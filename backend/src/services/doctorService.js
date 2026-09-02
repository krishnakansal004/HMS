import { DoctorRepository } from "../repositories/doctorRepository.js";
import { AuditService } from "./auditService.js";
import { AppError } from "../middlewares/errorHandler.js";
import { HTTP_STATUS } from "../constants/httpStatus.js";
import { addNotificationJob } from "../queues/notificationQueue.js";
import { doctorApprovalTemplate } from "../utils/emailTemplates.js";
import { buildPublicFrontendUrl } from "../utils/publicUrl.js";
import { generateSetupToken } from "../utils/setupToken.js";
import { db } from "../config/db.js";

export class DoctorService {
  static async createDoctor({ tenantId, userId, data, ipAddress }) {
    // Validate email uniqueness in this hospital
    const exists = await DoctorRepository.findUserByEmail(tenantId, data.email);
    if (exists) {
      throw new AppError(
        "Email is already in use in this hospital.",
        HTTP_STATUS.CONFLICT,
      );
    }

    const { plainToken, tokenHash, expiresAt } = generateSetupToken();

    // Fetch the DOCTOR role ID from the database
    const doctorRole = await DoctorRepository.findRoleByName("DOCTOR");
    if (!doctorRole) {
      throw new AppError(
        "System configuration error: DOCTOR role missing.",
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
      );
    }

    // Create the User and Profile via Repository Transaction
    const doctor = await DoctorRepository.createTransaction({
      tenantId,
      roleId: doctorRole.role_id,
      name: data.name,
      email: data.email.toLowerCase(),
      phone: data.phone,
      passwordHash: null,
      passwordResetTokenHash: tokenHash,
      passwordResetExpires: expiresAt,
      designation: data.designation || "Dr.",
      specialization: data.specialization,
      departmentLabel: data.department,
      experienceYears: Number(data.experienceYears) || 0,
      consultationFee: Number(data.consultationFee) || 0,
    });

    // Audit Logging
    AuditService.logAction({
      tenantId,
      userId,
      action: "REGISTER_DOCTOR",
      entityType: "DOCTOR_PROFILE",
      entityId: doctor.doctor_profile.doctor_profile_id,
      newValue: { email: doctor.email },
      ipAddress,
    });

    // Sent now, with a real setup link (token + this tenant's
    // slug -- see authService.completeAccountSetup for why both are
    // needed), not a password.
    const tenant = await db.tenant.findUnique({
      where: { tenant_id: tenantId },
    });
    const setupUrl = `${buildPublicFrontendUrl("")}/portal/${tenant?.slug}/setup-password?token=${plainToken}`;
    const emailTpl = doctorApprovalTemplate(
      {
        name: data.name,
        email: doctor.email,
        specialization: data.specialization,
        department: data.department,
        yearsExperience: data.experienceYears,
        education: data.qualifications,
      },
      { setupUrl },
      tenant,
    );

    addNotificationJob("email", {
      to: doctor.email,
      subject: `Your account has been created — Welcome to ${tenant?.name || "the Hospital"}`,
      html: emailTpl.html,
      extra: { attachments: emailTpl.attachments },
    }).catch((err) =>
      console.error("[DoctorService] Failed to queue account-setup email", err),
    );

    return doctor;
  }

  static async listDoctors({ tenantId, query }) {
    const { search, page = 1, limit = 50 } = query;
    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    const [total, doctors] = await DoctorRepository.findManyPaginated({
      tenantId,
      search,
      skip,
      take,
    });

    return {
      total,
      page: Number(page),
      pages: Math.ceil(total / take),
      data: doctors,
    };
  }

  static async updateDoctor({ tenantId, doctorId, data, userId, ipAddress }) {
    const doctor = await DoctorRepository.updateTransaction({
      tenantId,
      doctorId,
      updateData: data,
    });

    AuditService.logAction({
      tenantId,
      userId,
      action: "UPDATE_DOCTOR",
      entityType: "DOCTOR_PROFILE",
      entityId: doctorId,
      newValue: { updated: true },
      ipAddress,
    });

    return doctor;
  }

  static async deleteDoctor({ tenantId, doctorId, hard, userId, ipAddress }) {
    if (hard) {
      await DoctorRepository.hardDelete(tenantId, doctorId);
    } else {
      await DoctorRepository.softDelete(tenantId, doctorId);
    }

    AuditService.logAction({
      tenantId,
      userId,
      action: hard ? "HARD_DELETE_DOCTOR" : "SOFT_DELETE_DOCTOR",
      entityType: "USER",
      entityId: doctorId,
      ipAddress,
    });
  }

  static async getDoctorById({ tenantId, doctorId }) {
    const doctor = await DoctorRepository.findByIdAndTenant(tenantId, doctorId);
    if (!doctor) throw new AppError("Doctor not found.", HTTP_STATUS.NOT_FOUND);
    return doctor;
  }
}
