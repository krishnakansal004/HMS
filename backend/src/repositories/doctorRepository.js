import { db } from '../config/db.js';

export class DoctorRepository {
  static async findUserByEmail(tenantId, email) {
    return db.users.findFirst({
      where: { tenant_id: tenantId, email: email.toLowerCase(), deleted_at: null } //[cite: 3]
    });
  }

  static async findRoleByName(name) {
    return db.role.findUnique({
      where: { name } //[cite: 3]
    });
  }

  static async createTransaction(data) {
    // Wrap user and profile creation in a single transaction[cite: 3]
    return db.$transaction(async (tx) => {
      const user = await tx.users.create({
        data: {
          tenant_id: data.tenantId, //[cite: 3]
          role_id: data.roleId, //[cite: 3]
          name: data.name,
          email: data.email,
          password_hash: data.passwordHash, //[cite: 3]
          must_change_password: true //[cite: 3]
        }
      });

      const profile = await tx.doctor_profile.create({
        data: {
          user_id: user.user_id, //[cite: 3]
          tenant_id: data.tenantId, //[cite: 3]
          designation: data.designation,
          specialization: data.specialization,
          department_label: data.departmentLabel, //[cite: 3]
          experience_years: data.experienceYears, //[cite: 3]
          consultation_fee: data.consultationFee, //[cite: 3]
          active: true //[cite: 3]
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

    // Changed from db.$transaction to Promise.all to bypass the proxy type-error
    return Promise.all([
      db.users.count({ where }),
      db.users.findMany({
        where,
        skip,
        take,
        include: {
          doctor_profile: true 
        }
      })
    ]);
  }

  static async updateTransaction({ tenantId, doctorId, updateData }) {
    return db.$transaction(async (tx) => {
      // 1. Update core user fields if provided
      const userUpdate = {};
      if (updateData.name) userUpdate.name = updateData.name;
      if (updateData.email) userUpdate.email = updateData.email;

      if (Object.keys(userUpdate).length > 0) {
        await tx.users.update({
          where: { user_id: doctorId }, //[cite: 3]
          data: userUpdate
        });
      }

      // 2. Update doctor_profile fields if provided
      const profileUpdate = {};
      if (updateData.designation) profileUpdate.designation = updateData.designation;
      if (updateData.specialization) profileUpdate.specialization = updateData.specialization;
      if (updateData.department) profileUpdate.department_label = updateData.department; //[cite: 3]
      if (updateData.experienceYears !== undefined) profileUpdate.experience_years = updateData.experienceYears; //[cite: 3]
      if (updateData.consultationFee !== undefined) profileUpdate.consultation_fee = updateData.consultationFee; //[cite: 3]
      if (updateData.active !== undefined) profileUpdate.active = updateData.active; //[cite: 3]

      if (Object.keys(profileUpdate).length > 0) {
        await tx.doctor_profile.update({
          where: { user_id: doctorId }, //[cite: 3]
          data: profileUpdate
        });
      }

      return tx.users.findUnique({
        where: { user_id: doctorId }, //[cite: 3]
        include: { doctor_profile: true } //[cite: 3]
      });
    });
  }

  static async softDelete(tenantId, doctorId) {
    // Sets active to false in the profile instead of deleting[cite: 3]
    return db.doctor_profile.update({
      where: { user_id: doctorId, tenant_id: tenantId }, //[cite: 3]
      data: { active: false } //[cite: 3]
    });
  }

  static async hardDelete(tenantId, doctorId) {
    // Because of `onDelete: Cascade` in your schema, deleting the user 
    // will automatically delete the linked doctor_profile[cite: 3].
    return db.users.delete({
      where: { user_id: doctorId, tenant_id: tenantId } //[cite: 3]
    });
  }
}