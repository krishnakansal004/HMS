import { db } from '../config/db.js';

export class UserRepository {
  static async findUserByEmail(email) {
    return db.users.findFirst({
      where: { email },
      include: { 
        role: true, 
        tenant: {
          include: { plan: true }
        } 
      },
    });
  }

  static async findUserById(userId) {
    return db.users.findUnique({
      where: { user_id: userId },
      include: { role: true, tenant: true },
    });
  }

  static async findTenantBySlug(slug) {
    return db.tenant.findUnique({
      where: { slug },
      include: { plan: true }
    });
  }

  static async findRoleByName(roleName) {
    return db.role.findUnique({
      where: { name: roleName }
    });
  }

  static async createPatientUser(userData, patientData) {
    return db.$transaction(async (tx) => {

      await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${userData.tenant_id}::text, true)`;
      
      const user = await tx.users.create({
        data: userData,
        include: { role: true }
      });

      await tx.patient.create({
        data: {
          ...patientData,
          user_id: user.user_id
        }
      });

      return user;
    });
  }
}