import { db } from '../config/db.js';
import { AppError } from '../middlewares/errorHandler.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';

export class DoctorRepository {
  static async findUserByEmail(tenantId, email) {
    return db.users.findFirst({
      where: { tenant_id: tenantId, email: email.toLowerCase(), deleted_at: null }
    });
  }

  static async findRoleByName(name) {
    return db.role.findUnique({
      where: { name }
    });
  }

  static async createTransaction(data) {
    return db.$transaction(async (tx) => {
      const user = await tx.users.create({
        data: {
          tenant_id: data.tenantId,
          role_id: data.roleId,
          name: data.name,
          email: data.email,
          password_hash: data.passwordHash,
          password_reset_token: data.passwordResetTokenHash || null,
          password_reset_expires: data.passwordResetExpires || null,
          must_change_password: true
        }
      });

      const profile = await tx.doctor_profile.create({
        data: {
          user_id: user.user_id,
          tenant_id: data.tenantId,
          designation: data.designation,
          specialization: data.specialization,
          department_label: data.departmentLabel,
          experience_years: data.experienceYears,
          consultation_fee: data.consultationFee,
          active: true
        }
      });

      return { ...user, doctor_profile: profile };
    });
  }

  static async findManyPaginated({ tenantId, search, skip, take }) {
    const where = {
      tenant_id: tenantId, 
      deleted_at: null, 
      role: { name: 'DOCTOR' } 
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { doctor_profile: { department_label: { contains: search, mode: 'insensitive' } } } 
      ];
    }

    // Utilizing interactive RLS transaction.
    return db.$transaction(async (tx) => {
      const [total, doctors] = await Promise.all([
        tx.users.count({ where }),
        tx.users.findMany({
          where,
          skip,
          take,
          include: {
            doctor_profile: true 
          }
        })
      ]);
      return [total, doctors];
    });
  }

  static async updateTransaction({ tenantId, doctorId, updateData }) {
    return db.$transaction(async (tx) => {
      const userUpdate = {};
      if (updateData.name) userUpdate.name = updateData.name;
      if (updateData.email) userUpdate.email = updateData.email;

      if (Object.keys(userUpdate).length > 0) {
        await tx.users.updateMany({
          where: { user_id: doctorId, tenant_id: tenantId, deleted_at: null },
          data: { ...userUpdate, updated_at: new Date() }
        });
      }

      const profileUpdate = {};
      if (updateData.designation) profileUpdate.designation = updateData.designation;
      if (updateData.specialization) profileUpdate.specialization = updateData.specialization;
      if (updateData.department) profileUpdate.department_label = updateData.department;
      if (updateData.experienceYears !== undefined) profileUpdate.experience_years = updateData.experienceYears;
      if (updateData.consultationFee !== undefined) profileUpdate.consultation_fee = updateData.consultationFee;
      if (updateData.active !== undefined) profileUpdate.active = updateData.active;

      if (Object.keys(profileUpdate).length > 0) {
        await tx.doctor_profile.updateMany({
          where: { user_id: doctorId, tenant_id: tenantId, deleted_at: null },
          data: { ...profileUpdate, updated_at: new Date() }
        });
      }

      return tx.users.findFirst({
        where: { user_id: doctorId, tenant_id: tenantId, deleted_at: null },
        include: { doctor_profile: true }
      });
    });
  }

  static async findByIdAndTenant(tenantId, doctorId) {
    return db.users.findFirst({
      where: { user_id: doctorId, tenant_id: tenantId, role: { name: 'DOCTOR' }, deleted_at: null },
      include: { doctor_profile: true }
    });
  }
  
  static async softDelete(tenantId, doctorId) {
    const now = new Date();
    return db.doctor_profile.updateMany({
      where: { user_id: doctorId, tenant_id: tenantId, deleted_at: null },
      data: { active: false, updated_at: now }
    });
  }

  static async hardDelete(tenantId, doctorId) {
    return db.$transaction(async (tx) => {
      // Find the profile to get the doctor_profile_id
      const profile = await tx.doctor_profile.findFirst({
        where: { user_id: doctorId, tenant_id: tenantId, deleted_at: null }
      });

      if (profile) {
        // Block deletion if active appointments exist
        const activeAppointments = await tx.appointment.count({
          where: {
            doctor_id: profile.doctor_profile_id,
            tenant_id: tenantId,
            deleted_at: null,
            status: { in: ['confirmed', 'scheduled', 'in_progress'] }
          }
        });

        if (activeAppointments > 0) {
          throw new AppError(
            'Cannot delete doctor with active appointments. Please reassign or cancel them first.',
            HTTP_STATUS.CONFLICT
          );
        }

        // Block deletion if active patient admissions exist
        const activeAdmissions = await tx.admission.count({
          where: {
            admitting_doctor_id: profile.doctor_profile_id,
            tenant_id: tenantId,
            deleted_at: null,
            status: 'admitted'
          }
        });

        if (activeAdmissions > 0) {
          throw new AppError(
            'Cannot delete doctor with active patient admissions. Please reassign patients first.',
            HTTP_STATUS.CONFLICT
          );
        }

        const now = new Date();
        // Strict soft-delete on doctor_profile to protect clinical history and avoid FK violations
        await tx.doctor_profile.updateMany({
          where: { doctor_profile_id: profile.doctor_profile_id, tenant_id: tenantId, deleted_at: null },
          data: { active: false, deleted_at: now, updated_at: now }
        });
      }

      const now = new Date();
      // Strict soft-delete on base user record
      return tx.users.updateMany({
        where: { user_id: doctorId, tenant_id: tenantId, deleted_at: null },
        data: { deleted_at: now, updated_at: now }
      });
    });
  }
}