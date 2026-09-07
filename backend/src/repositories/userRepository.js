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
      // Temporarily bypass RLS to provision the new user securely
      await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${userData.tenant_id}::text, true)`;

      const user = await tx.users.create({
        data: userData,
        include: { role: true }
      });

      // Deterministic Demographic Matching
      // We do NOT match purely on email because migration 0058 allows dependents to share emails.
      // We must match exactly on Email + First Name + Last Name + DOB.
      
      const potentialMatches = await tx.patient.findMany({
        where: {
          tenant_id: userData.tenant_id,
          email: userData.email.toLowerCase(),
          first_name: { equals: patientData.first_name, mode: 'insensitive' },
          date_of_birth: new Date(patientData.date_of_birth),
          user_id: null // Only link to a record that hasn't been claimed yet
        }
      });

      const exactMatches = potentialMatches.filter(p => 
        (p.last_name || '').trim().toLowerCase() === (patientData.last_name || '').trim().toLowerCase()
      );

      if (exactMatches.length === 1) {
        // One unclaimed clinical record perfectly matches all demographics.
        await tx.patient.update({
          where: { patient_id: exactMatches[0].patient_id },
          data: { 
            user_id: user.user_id, 
            phone: patientData.phone, // Refresh with their latest phone number
            gender: patientData.gender,
            updated_at: new Date() 
          }
        });
      } else {
        await tx.patient.create({
          data: {
            ...patientData,
            user_id: user.user_id
          }
        });
      }

      return user;
    });
  }
}