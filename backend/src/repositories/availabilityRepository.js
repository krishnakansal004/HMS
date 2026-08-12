import { db } from '../config/db.js';

export class AvailabilityRepository {
  
  static async findByDoctor(tenantId, doctorId) {
    return db.doctor_availability.findFirst({
      where: { 
        tenant_id: tenantId, 
        doctor_id: doctorId 
      }
    });
  }

  static async checkDoctorExists(tenantId, doctorId) {
    return db.users.findFirst({
      where: {
        user_id: doctorId,
        tenant_id: tenantId,
        role: { name: 'DOCTOR' },
        deleted_at: null
      }
    });
  }

  static async upsertAvailability(tenantId, doctorId, days, exceptions) {
    // Because doctor_id is marked as @unique in the schema, we can safely use it in Prisma's upsert
    return db.doctor_availability.upsert({
      where: { 
        doctor_id: doctorId 
      },
      update: {
        days,
        exceptions,
        updated_at: new Date()
      },
      create: {
        tenant_id: tenantId,
        doctor_id: doctorId,
        days,
        exceptions
      }
    });
  }
}