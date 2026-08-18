import bcrypt from 'bcryptjs';
import { DoctorRepository } from '../repositories/doctorRepository.js';
import { AuditService } from './auditService.js';
import { AppError } from '../middlewares/errorHandler.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';

export class DoctorService {
  static async createDoctor({ tenantId, userId, data, ipAddress }) {
    // 1. Validate email uniqueness in this hospital
    const exists = await DoctorRepository.findUserByEmail(tenantId, data.email);
    if (exists) {
      throw new AppError('Email is already in use in this hospital.', HTTP_STATUS.CONFLICT);
    }

    // 2. Auto-generate password if not provided
    const plainPassword = data.password || Math.random().toString(36).slice(-10);
    const passwordHash = await bcrypt.hash(plainPassword, 12);

    // 3. Fetch the DOCTOR role ID from the database
    const doctorRole = await DoctorRepository.findRoleByName('DOCTOR');
    if (!doctorRole) {
      throw new AppError('System configuration error: DOCTOR role missing.', HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }

    // 4. Create the User and Profile via Repository Transaction
    const doctor = await DoctorRepository.createTransaction({
      tenantId,
      roleId: doctorRole.role_id,
      name: data.name,
      email: data.email.toLowerCase(),
      phone: data.phone,
      passwordHash,
      designation: data.designation || 'Dr.',
      specialization: data.specialization,
      departmentLabel: data.department,
      experienceYears: Number(data.experienceYears) || 0,
      consultationFee: Number(data.consultationFee) || 0,
    });

    // 5. Audit Logging
    AuditService.logAction({
      tenantId,
      userId,
      action: 'REGISTER_DOCTOR',
      entityType: 'DOCTOR_PROFILE',
      entityId: doctor.doctor_profile.doctor_profile_id,
      newValue: { email: doctor.email },
      ipAddress
    });

    // TODO: Send email to the new doctor with their `plainPassword` here.

    return doctor;
  }

  static async listDoctors({ tenantId, query }) {
    const { search, page = 1, limit = 50 } = query;
    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    const [total, doctors] = await DoctorRepository.findManyPaginated({
      tenantId, search, skip, take
    });

    return { total, page: Number(page), pages: Math.ceil(total / take), data: doctors };
  }

  static async updateDoctor({ tenantId, doctorId, data, userId, ipAddress }) {
    const doctor = await DoctorRepository.updateTransaction({
      tenantId,
      doctorId,
      updateData: data
    });

    AuditService.logAction({
      tenantId,
      userId,
      action: 'UPDATE_DOCTOR',
      entityType: 'DOCTOR_PROFILE',
      entityId: doctorId,
      newValue: { updated: true },
      ipAddress
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
      action: hard ? 'HARD_DELETE_DOCTOR' : 'SOFT_DELETE_DOCTOR',
      entityType: 'USER',
      entityId: doctorId,
      ipAddress
    });
  }
}