import { PatientRepository } from '../repositories/patientRepository.js';
import { AuditService } from './auditService.js';
import { AppError } from '../middlewares/errorHandler.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';
import crypto from 'crypto';

export class PatientService {
  
  static async registerPatient({ tenantId, userId, data, ipAddress }) {
    // 1. Check if email or phone already exists within this specific tenant
    if (data.email || data.phone) {
      const existing = await PatientRepository.findByEmailOrPhone(tenantId, data.email, data.phone);
      if (existing) {
        throw new AppError('A patient with this email or phone number already exists in this hospital.', HTTP_STATUS.CONFLICT);
      }
    }
    // ### NOT IN PRISMA SCHEMA REMOVED CURRENTLY
    // 2. Generate unique Medical Record Number (MRN) 
    // const mrn = `MRN-${Date.now().toString().slice(-6)}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;

    // 3. Map directly to Prisma schema column mappings
    const patientData = {
      first_name: data.firstName,
      last_name: data.lastName || null,
      email: data.email ? data.email.toLowerCase() : null,
      phone: data.phone,
      date_of_birth: new Date(data.dob),
      gender: data.gender,
      blood_group: data.bloodGroup || null,
      address: data.address || null,
      is_admitted: false
    };

    const patient = await PatientRepository.create(tenantId, patientData);

    // 4. Audit Logging
    AuditService.logAction({
      tenantId,
      userId,
      action: 'REGISTER_PATIENT',
      entityType: 'PATIENT',
      entityId: patient.patient_id,
      newValue: { name: `${patient.first_name} ${patient.last_name || ''}`.trim() },
      ipAddress
    });

    return patient;
  }

  static async getPatientById({ tenantId, patientId }) {
    const patient = await PatientRepository.findByIdAndTenant(patientId, tenantId);
    if (!patient) {
      throw new AppError('Patient record not found.', HTTP_STATUS.NOT_FOUND);
    }
    return patient;
  }

  static async updatePatient({ tenantId, userId, patientId, data, ipAddress }) {
    const patient = await PatientRepository.findByIdAndTenant(patientId, tenantId);
    if (!patient) {
      throw new AppError('Patient record not found.', HTTP_STATUS.NOT_FOUND);
    }

    const updateData = {};
    if (data.firstName) updateData.first_name = data.firstName;
    if (data.lastName !== undefined) updateData.last_name = data.lastName;
    if (data.phone) updateData.phone = data.phone;
    if (data.address !== undefined) updateData.address = data.address;
    if (data.emergencyContact !== undefined) updateData.emergency_contact = data.emergencyContact;
    if (data.allergies !== undefined) updateData.allergies = data.allergies;
    if (data.medicalHistory !== undefined) updateData.medical_history = data.medicalHistory;
    if (data.bloodGroup) updateData.blood_group = data.bloodGroup;

    await PatientRepository.update(patientId, tenantId, updateData);
    const updatedPatient = await PatientRepository.findByIdAndTenant(patientId, tenantId);

    AuditService.logAction({
      tenantId,
      userId,
      action: 'UPDATE_PATIENT',
      entityType: 'PATIENT',
      entityId: patientId,
      oldValue: { firstName: patient.first_name, phone: patient.phone },
      newValue: updateData,
      ipAddress
    });

    return updatedPatient;
  }

  static async listPatients({ tenantId, query }) {
    const { search, page = 1, limit = 50 } = query;
    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    const [total, patients] = await PatientRepository.findManyPaginated({
      tenantId, search, skip, take
    });

    return {
      total,
      page: Number(page),
      pages: Math.ceil(total / take),
      data: patients
    };
  }
}