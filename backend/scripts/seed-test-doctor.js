// scripts/seed-test-user.js
import { prisma } from '../src/config/db.js';
import bcrypt from 'bcrypt';

async function seedTestData() {
  console.log('🌱 Seeding test tenant, roles, admin, and doctor...');

  const tenantId = '11111111-1111-1111-1111-111111111111';
  const adminRoleId = '22222222-2222-2222-2222-222222222222';
  const doctorRoleId = '44444444-4444-4444-4444-444444444444';
  const doctorUserId = '55555555-5555-5555-5555-555555555555';
  const doctorProfileId = 'f47ac10b-58cc-4372-a567-0e02b2c3d479'; // <--- Valid v4 UUID

  try {
    await prisma.tenant.upsert({
      where: { tenant_id: tenantId },
      update: { name: 'E2E Test Hospital', slug: 'e2e-test-hospital', status: 'active' },
      create: { tenant_id: tenantId, name: 'E2E Test Hospital', slug: 'e2e-test-hospital', status: 'active' }
    });

    await prisma.role.upsert({
      where: { role_id: adminRoleId },
      update: { name: 'HOSPITAL_ADMIN' },
      create: { role_id: adminRoleId, name: 'HOSPITAL_ADMIN', description: 'Hospital Administrator role' }
    });

    await prisma.role.upsert({
      where: { role_id: doctorRoleId },
      update: { name: 'DOCTOR' },
      create: { role_id: doctorRoleId, name: 'DOCTOR', description: 'Doctor role' }
    });

    const hashedPassword = await bcrypt.hash('Password123!', 10);
    const existingAdmin = await prisma.users.findFirst({ where: { email: 'admin@testhospital.com' } });
    if (existingAdmin) {
      await prisma.users.update({
        where: { user_id: existingAdmin.user_id },
        data: { password_hash: hashedPassword, role_id: adminRoleId }
      });
    } else {
      await prisma.users.create({
        data: {
          tenant_id: tenantId,
          role_id: adminRoleId,
          name: 'Super Admin',
          email: 'admin@testhospital.com',
          password_hash: hashedPassword
        }
      });
    }

    const existingDoctorUser = await prisma.users.findFirst({ where: { email: 'doctor@testhospital.com' } });
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
          name: 'Dr. House',
          email: 'doctor@testhospital.com',
          password_hash: hashedPassword
        }
      });
      actualDoctorUserId = newDocUser.user_id;
    }

    await prisma.doctor_profile.upsert({
      where: { user_id: actualDoctorUserId },
      update: { tenant_id: tenantId, specialization: 'General Medicine' },
      create: {
        doctor_profile_id: doctorProfileId,
        user_id: actualDoctorUserId,
        tenant_id: tenantId,
        specialization: 'General Medicine'
      }
    });

    console.log('🎉 Test database seeded successfully with Admin and Doctor profiles!');
  } catch (error) {
    console.error('❌ Seeding failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

seedTestData();