import { db, tenantStorage } from '../config/db.js';

export class DoctorManagementRepository {
  // Public submission -- tenantId is required, but there's no JWT/session yet.
  // We must inject the tenant context so the RLS WITH CHECK policy allows the insert.
  static async createPublicApplication(tenantId, data) {
    return tenantStorage.run({ tenantId }, () =>
      db.doctor_application.create({
        data: {
          tenant_id: tenantId,
          name: data.name,
          email: data.email.toLowerCase(),
          phone: data.phone || null,
          specialization: data.specialization,
          department: data.department || null,
          education: data.education || null,
          years_experience: data.yearsExperience ? Number(data.yearsExperience) : null,
          address: data.address || null,
          message: data.message || null,
          status: 'PENDING'
        }
      })
    );
  }


  static async checkPendingApplication(tenantId, email) {
    return db.doctor_application.findFirst({
      where: { 
        tenant_id: tenantId, 
        email: email.toLowerCase(), 
        status: 'PENDING' 
      },
      select: { application_id: true } // Only fetch the ID 
    });
  }

  static async findApplicationByIdAndTenant(applicationId, tenantId) {
    return db.doctor_application.findFirst({
      where: { application_id: applicationId, tenant_id: tenantId }
    });
  }

  static async approveApplicationTransaction({ tenantId, reviewerId, applicationId, application, passwordResetTokenHash, passwordResetExpires }) {
    return db.$transaction(async (tx) => {
      const role = await tx.role.findUnique({ where: { name: 'DOCTOR' } });
      if (!role) throw new Error('ROLE_NOT_FOUND');

      // Create the base user identity.
      const user = await tx.users.create({
        data: {
          tenant_id: tenantId,
          role_id: role.role_id,
          name: application.name,
          email: application.email,
          password_hash: null,
          password_reset_token: passwordResetTokenHash,
          password_reset_expires: passwordResetExpires,
          must_change_password: true
        }
      });

      // Create the clinical doctor profile mapped to the user
      const profile = await tx.doctor_profile.create({
        data: {
          user_id: user.user_id,
          tenant_id: tenantId,
          specialization: application.specialization,
          department_label: application.department,
          experience_years: application.years_experience,
          active: true
        }
      });

      // Mark the application as approved
      const updatedApp = await tx.doctor_application.update({
        where: { application_id: applicationId, tenant_id: tenantId },
        data: {
          status: 'APPROVED',
          reviewed_by: reviewerId,
          reviewed_at: new Date(),
          updated_at: new Date()
        }
      });

      return { user, profile, updatedApp };
    });
  }

  static async findManyPaginated({ tenantId, status, skip, take }) {
    const where = { tenant_id: tenantId };
    if (status) where.status = status;
    return db.$transaction(async (tx) => {
      const [total, applications] = await Promise.all([
        tx.doctor_application.count({ where }),
        tx.doctor_application.findMany({
          where, skip, take, orderBy: { created_at: 'desc' }
        })
      ]);
      return [total, applications];
    });
  }

  static async rejectApplication(tenantId, reviewerId, applicationId) {
    return db.doctor_application.update({
      where: { application_id: applicationId, tenant_id: tenantId },
      data: {
        status: 'REJECTED',
        reviewed_by: reviewerId,
        reviewed_at: new Date(),
        updated_at: new Date()
      }
    });
  }
}
