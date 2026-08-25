import { db } from "../config/db.js";

export class AvailabilityRepository {
  static async resolveDoctorProfileId(tenantId, userId) {
    const profile = await db.doctor_profile.findFirst({
      where: { user_id: userId, tenant_id: tenantId },
    });
    return profile?.doctor_profile_id || null;
  }

  static async findByDoctor(tenantId, doctorUserId) {
    const doctorProfileId = await this.resolveDoctorProfileId(
      tenantId,
      doctorUserId,
    );
    if (!doctorProfileId) return null;

    return db.doctor_availability.findFirst({
      where: {
        tenant_id: tenantId,
        doctor_id: doctorProfileId,
      },
    });
  }

  static async checkDoctorExists(tenantId, doctorUserId) {
    return db.users.findFirst({
      where: {
        user_id: doctorUserId,
        tenant_id: tenantId,
        role: { name: "DOCTOR" },
        deleted_at: null,
      },
    });
  }

  static async upsertAvailability(tenantId, doctorUserId, days, exceptions) {
    const doctorProfileId = await this.resolveDoctorProfileId(
      tenantId,
      doctorUserId,
    );
    if (!doctorProfileId) {
      throw new Error("DOCTOR_PROFILE_NOT_FOUND");
    }
    return db.doctor_availability.upsert({
      where: {
        doctor_id: doctorProfileId,
      },
      update: {
        days,
        exceptions,
        updated_at: new Date(),
      },
      create: {
        tenant_id: tenantId,
        doctor_id: doctorProfileId,
        days,
        exceptions,
      },
    });
  }
}
