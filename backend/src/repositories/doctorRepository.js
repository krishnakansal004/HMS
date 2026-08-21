import { db } from '../config/db.js';

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
        // user_id is the PK, so update() is valid here
        await tx.users.update({
          where: { user_id: doctorId },
          data: userUpdate
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
        // user_id is @unique in Prisma, so update() is valid here
        await tx.doctor_profile.update({
          where: { user_id: doctorId },
          data: profileUpdate
        });
      }

      return tx.users.findUnique({
        where: { user_id: doctorId },
        include: { doctor_profile: true }
      });
    });
  }

  static async softDelete(tenantId, doctorId) {
    // updateMany safely supports non-composite multi-field queries (tenant_id)
    return db.doctor_profile.updateMany({
      where: { user_id: doctorId, tenant_id: tenantId },
      data: { active: false }
    });
  }

  static async hardDelete(tenantId, doctorId) {
    // deleteMany safely supports non-composite multi-field queries (tenant_id)
    return db.users.deleteMany({
      where: { user_id: doctorId, tenant_id: tenantId }
    });
  }
}