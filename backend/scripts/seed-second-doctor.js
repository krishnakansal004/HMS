// scripts/seed-second-doctor.js
// Adds a second doctor (Doctor B) to the SAME tenant as the one created by
// seed-test-doctor.js, so cross-doctor data isolation can be tested without
// tenant isolation getting in the way.
import { prisma } from '../src/config/db.js';
import bcrypt from 'bcrypt';

async function seedSecondDoctor() {
  console.log('🌱 Seeding second doctor in the E2E Test Hospital tenant...');

  const tenantId = '11111111-1111-1111-1111-111111111111';
  const doctorRoleId = '44444444-4444-4444-4444-444444444444';
  const doctorUserId = '66666666-6666-6666-6666-666666666666';
  const doctorProfileId = '77777777-7777-7777-7777-777777777777';

  try {
    const tenant = await prisma.tenant.findUnique({ where: { tenant_id: tenantId } });
    if (!tenant) {
      throw new Error('Tenant not found. Run seed-test-doctor.js first.');
    }

    const hashedPassword = await bcrypt.hash('Password123!', 10);
    const existingDoctorUser = await prisma.users.findFirst({ where: { email: 'doctor2@testhospital.com' } });
    let actualDoctorUserId = doctorUserId;
    if (existingDoctorUser) {
      actualDoctorUserId = existingDoctorUser.user_id;
      await prisma.users.update({
        where: { user_id: actualDoctorUserId },
        data: { password_hash: hashedPassword, role_id: doctorRoleId }
      });
    } else {
      const newDocUser = await prisma.users.create({
        data: {
          user_id: doctorUserId,
          tenant_id: tenantId,
          role_id: doctorRoleId,
          name: 'Dr. Wilson',
          email: 'doctor2@testhospital.com',
          password_hash: hashedPassword
        }
      });
      actualDoctorUserId = newDocUser.user_id;
    }

    const existingDoctorProfile = await prisma.doctor_profile.findFirst({ where: { user_id: actualDoctorUserId } });
    if (existingDoctorProfile) {
      await prisma.doctor_profile.update({
        where: { doctor_profile_id: existingDoctorProfile.doctor_profile_id },
        data: { tenant_id: tenantId, specialization: 'Cardiology' }
      });
    } else {
      await prisma.doctor_profile.create({
        data: {
          doctor_profile_id: doctorProfileId,
          user_id: actualDoctorUserId,
          tenant_id: tenantId,
          specialization: 'Cardiology'
        }
      });
    }

    console.log('🎉 Second doctor seeded: doctor2@testhospital.com / Password123! (hospital ID: e2e-test-hospital)');
  } catch (error) {
    console.error('❌ Seeding failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

seedSecondDoctor();
