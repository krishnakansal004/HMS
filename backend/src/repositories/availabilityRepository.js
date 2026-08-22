import { db } from '../config/db.js';
import { AppError } from '../middlewares/errorHandler.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';

export class AvailabilityRepository {
  // INTERNAL HELPER: Resolve JWT user_id to physical doctor_profile_id
  static async resolveProfileId(tenantId, userId) {
    const profile = await db.doctor_profile.findFirst({
      where: { tenant_id: tenantId, user_id: userId }
    });
    return profile?.doctor_profile_id;
  }

  static async findByDoctor(tenantId, userId) {
    const profileId = await this.resolveProfileId(tenantId, userId);
    if (!profileId) return null;

    return db.doctor_availability.findFirst({
      where: { 
        tenant_id: tenantId, 
        doctor_id: profileId 
      }
    });
  }

  static async checkDoctorExists(tenantId, userId) {
    // This correctly validates the users table
    return db.users.findFirst({
      where: {
        user_id: userId,
        tenant_id: tenantId,
        role: { name: 'DOCTOR' },
        deleted_at: null
      }
    });
  }

  static async upsertAvailability(tenantId, userId, days, exceptions) {
    const profileId = await this.resolveProfileId(tenantId, userId);
    
    if (!profileId) {
      throw new AppError('Valid doctor profile required to set availability.', HTTP_STATUS.BAD_REQUEST);
    }

    // Upsert using Prisma's generated composite unique identifier
    return db.doctor_availability.upsert({
      where: { 
        tenant_id_doctor_id: {
          tenant_id: tenantId,
          doctor_id: profileId
        }
      },
      update: {
        days,
        exceptions,
        updated_at: new Date()
      },
      create: {
        tenant_id: tenantId,
        doctor_id: profileId,
        days,
        exceptions
      }
    });
  }
}