import { PatientRepository } from "../repositories/patientRepository.js";
import { AuditService } from "./auditService.js";
import { AppError } from "../middlewares/errorHandler.js";
import { HTTP_STATUS } from "../constants/httpStatus.js";
import { db } from "../config/db.js";
import { generateSetupToken } from "../utils/setupToken.js";
import { addNotificationJob } from "../queues/notificationQueue.js";
import { buildPublicFrontendUrl } from "../utils/publicUrl.js";

export class PatientService {
  static async registerPatient({ tenantId, userId, data, ipAddress }) {
    const patientData = {
      first_name: data.firstName,
      last_name: data.lastName || null,
      email: data.email ? data.email.toLowerCase() : null,
      phone: data.phone,
      date_of_birth: data.dob ? new Date(data.dob) : null,
      gender: data.gender,
      blood_group: data.bloodGroup || null,
      address: data.address || null,

      // Clinical Fields
      emergency_contact: data.emergencyContact || null,
      allergies: data.allergies || null,
      medical_history: data.medicalHistory || null,

      // ABHA Normalization: Strip hyphens before saving so it's a clean 14-digit string
      abha_id: data.abhaId ? data.abhaId.replace(/-/g, "") : null,
      abha_address: data.abhaAddress || null,
    };

    // Persist to Database via Repository
    const patient = await PatientRepository.create(tenantId, patientData);

    // Audit Logging
    AuditService.logAction({
      tenantId,
      userId,
      action: "REGISTER_PATIENT",
      entityType: "PATIENT",
      entityId: patient.patient_id,
      newValue: {
        firstName: patient.first_name,
        lastName: patient.last_name,
        email: patient.email,
        phone: patient.phone,
        bloodGroup: patient.blood_group,
        abhaLinked: !!patient.abha_id,
      },
      ipAddress,
    });

    return patient;
  }

  static async getPatientById({ tenantId, patientId, userId, userRole }) {
    const patient = await PatientRepository.findByIdAndTenant(
      patientId,
      tenantId,
    );
    if (!patient) {
      throw new AppError("Patient record not found.", HTTP_STATUS.NOT_FOUND);
    }
    if (userRole === "PATIENT") {
      const ownRecord = await db.patient.findFirst({
        where: { user_id: userId, tenant_id: tenantId },
      });
      if (!ownRecord || ownRecord.patient_id !== patientId) {
        throw new AppError("Patient record not found.", HTTP_STATUS.NOT_FOUND);
      }
    }
    return patient;
  }

  static async updatePatient({ tenantId, userId, patientId, data, ipAddress }) {
    // Find patient within the current tenant
    const patient = await PatientRepository.findByIdAndTenant(
      patientId,
      tenantId,
    );

    if (!patient) {
      throw new AppError("Patient record not found.", HTTP_STATUS.NOT_FOUND);
    }

    // Build partial update object based on Prisma schema
    const updateData = {};

    if (data.firstName !== undefined) updateData.first_name = data.firstName;
    if (data.lastName !== undefined)
      updateData.last_name = data.lastName || null;
    if (data.email !== undefined)
      updateData.email = data.email ? data.email.toLowerCase() : null;
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.dob !== undefined)
      updateData.date_of_birth = data.dob ? new Date(data.dob) : null;
    if (data.gender !== undefined) updateData.gender = data.gender;
    if (data.bloodGroup !== undefined)
      updateData.blood_group = data.bloodGroup || null;
    if (data.address !== undefined) updateData.address = data.address || null;

    // Restored Clinical Fields
    if (data.emergencyContact !== undefined)
      updateData.emergency_contact = data.emergencyContact || null;
    if (data.allergies !== undefined)
      updateData.allergies = data.allergies || null;
    if (data.medicalHistory !== undefined)
      updateData.medical_history = data.medicalHistory || null;

    // Restored ABHA Normalization
    if (data.abhaId !== undefined) {
      updateData.abha_id = data.abhaId ? data.abhaId.replace(/-/g, "") : null;
    }
    if (data.abhaAddress !== undefined) {
      updateData.abha_address = data.abhaAddress || null;
    }

    // is_admitted is intentionally NOT updated here.
    // Admission/discharge should be handled by dedicated workflows.

    if (Object.keys(updateData).length === 0) {
      return patient;
    }

    // Update patient
    await PatientRepository.update(patientId, tenantId, updateData);

    const updatedPatient = await PatientRepository.findByIdAndTenant(
      patientId,
      tenantId,
    );

    AuditService.logAction({
      tenantId,
      userId,
      action: "UPDATE_PATIENT",
      entityType: "PATIENT",
      entityId: patientId,
      oldValue: {
        firstName: patient.first_name,
        lastName: patient.last_name,
        email: patient.email,
        phone: patient.phone,
        dateOfBirth: patient.date_of_birth,
        gender: patient.gender,
        bloodGroup: patient.blood_group,
        address: patient.address,
        emergencyContact: patient.emergency_contact,
        allergies: patient.allergies,
        medicalHistory: patient.medical_history,
        abhaId: patient.abha_id,
        abhaAddress: patient.abha_address,
      },
      newValue: updateData,
      ipAddress,
    });

    return updatedPatient;
  }

  static async listPatients({ tenantId, query }) {
    const { search, page = 1, limit = 50, doctorId } = query;
    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    let doctorProfileId = null;

    if (doctorId) {
      // Translate the users.user_id into the clinical doctor_profile_id
      const profile = await db.doctor_profile.findFirst({
        where: { user_id: doctorId, tenant_id: tenantId }
      });
      
      if (profile) {
        doctorProfileId = profile.doctor_profile_id;
      } else {
        // If the doctor has no clinical profile, they have no patients yet
        return { total: 0, page: Number(page), pages: 0, data: [] };
      }
    }
    const [total, patients] = await PatientRepository.findManyPaginated({
      tenantId,
      search,
      skip,
      take,
      doctorProfileId 
    });

    return {
      total,
      page: Number(page),
      pages: Math.ceil(total / take),
      data: patients,
    };
  }

  static async inviteToPortal({ tenantId, userId, patientId, ipAddress }) {
    const patient = await db.patient.findFirst({
      where: { patient_id: patientId, tenant_id: tenantId }
    });
    
    if (!patient) throw new AppError("Patient not found.", HTTP_STATUS.NOT_FOUND);
    if (patient.user_id) throw new AppError("Patient is already linked to a portal account.", HTTP_STATUS.BAD_REQUEST);
    if (!patient.email) throw new AppError("An email address is required to invite a patient.", HTTP_STATUS.BAD_REQUEST);

    // Prevent unique constraint failures if email is already registered to another user
    const existingUser = await db.users.findFirst({
      where: { tenant_id: tenantId, email: patient.email.toLowerCase() }
    });
    if (existingUser) throw new AppError("This email is already registered to a patient portal account in this hospital. The patient does not need an invite.", HTTP_STATUS.CONFLICT);

    const role = await db.role.findUnique({ where: { name: 'PATIENT' } });
    if (!role) throw new AppError("System configuration error: PATIENT role missing.", HTTP_STATUS.INTERNAL_SERVER_ERROR);

    const { plainToken, tokenHash, expiresAt } = generateSetupToken();

    // Execute User creation and Patient linkage atomically
    const result = await db.$transaction(async (tx) => {
      const user = await tx.users.create({
        data: {
          tenant_id: tenantId,
          role_id: role.role_id,
          name: `${patient.first_name} ${patient.last_name || ''}`.trim(),
          email: patient.email.toLowerCase(),
          password_hash: null, // Force setup via email link
          password_reset_token: tokenHash,
          password_reset_expires: expiresAt,
          must_change_password: true,
        }
      });

      await tx.patient.update({
        where: { patient_id: patientId },
        data: { user_id: user.user_id, updated_at: new Date() }
      });

      return user;
    });

    AuditService.logAction({
      tenantId,
      userId,
      action: "INVITE_PATIENT_TO_PORTAL",
      entityType: "PATIENT",
      entityId: patientId,
      newValue: { email: patient.email, newUserId: result.user_id },
      ipAddress,
    });

    // Queue the setup email
    const tenant = await db.tenant.findUnique({ where: { tenant_id: tenantId } });
    const setupUrl = `${buildPublicFrontendUrl("")}/portal/${tenant?.slug}/setup-password?token=${plainToken}`;

    const html = `
      <div style="font-family: sans-serif; max-w: 600px; margin: 0 auto;">
        <h3>Welcome to ${tenant?.name || 'our hospital'}</h3>
        <p>Hello ${patient.first_name},</p>
        <p>Your healthcare provider has invited you to access your secure patient portal.</p>
        <p>Click the link below to set your password and view your appointments, prescriptions, and lab results:</p>
        <a href="${setupUrl}" style="background: #0ea5e9; color: white; padding: 12px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 10px; font-weight: bold;">Setup My Account</a>
        <p style="margin-top: 25px; font-size: 12px; color: #666;">This secure link will expire in 24 hours.</p>
      </div>
    `;

    addNotificationJob("email", {
      to: patient.email,
      subject: `Your Patient Portal Invitation - ${tenant?.name || 'Hospital'}`,
      html: html,
    }).catch(err => console.error("[PatientService] Failed to queue invite email", err));

    return { success: true, message: "Invitation email sent successfully." };
  }
}
