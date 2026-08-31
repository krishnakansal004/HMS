import { PatientRepository } from "../repositories/patientRepository.js";
import { AuditService } from "./auditService.js";
import { AppError } from "../middlewares/errorHandler.js";
import { HTTP_STATUS } from "../constants/httpStatus.js";
import crypto from "crypto";

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
    const { search, page = 1, limit = 50 } = query;
    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    const [total, patients] = await PatientRepository.findManyPaginated({
      tenantId,
      search,
      skip,
      take,
    });

    return {
      total,
      page: Number(page),
      pages: Math.ceil(total / take),
      data: patients,
    };
  }
}
