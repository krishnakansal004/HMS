// scripts/seed-test-user.js
import { prisma } from '../src/config/db.js';
import bcrypt from 'bcrypt';

async function seedTestData() {
  console.log('🌱 Seeding test tenant and admin user...');

  const tenantId = '11111111-1111-1111-1111-111111111111';
  const roleId = '22222222-2222-2222-2222-222222222222';

  try {
    // 1. Upsert Tenant
    await prisma.tenant.upsert({
      where: { tenant_id: tenantId },
      update: {
        name: 'E2E Test Hospital',
        slug: 'e2e-test-hospital',
        status: 'active'
      },
      create: {
        tenant_id: tenantId,
        name: 'E2E Test Hospital',
        slug: 'e2e-test-hospital',
        status: 'active'
      }
    });

    // 2. Upsert Role (HOSPITAL_ADMIN to match route expectations)
    await prisma.role.upsert({
      where: { role_id: roleId },
      update: { name: 'HOSPITAL_ADMIN' },
      create: {
        role_id: roleId,
        name: 'HOSPITAL_ADMIN',
        description: 'Hospital Administrator role for testing'
      }
    });

    // 3. Hash Password & Handle User
    const hashedPassword = await bcrypt.hash('Password123!', 10);
    const email = 'admin@testhospital.com';

    const existingUser = await prisma.users.findFirst({
      where: { tenant_id: tenantId, email: email }
    });

    if (existingUser) {
      await prisma.users.update({
        where: { user_id: existingUser.user_id },
        data: { 
          password_hash: hashedPassword,
          role_id: roleId 
        }
      });
      console.log('   🔄 Existing test user updated.');
    } else {
      await prisma.users.create({
        data: {
          tenant_id: tenantId,
          role_id: roleId,
          name: 'Super Admin',
          email: email,
          password_hash: hashedPassword
        }
      });
      console.log('   ✨ New test user created.');
    }

    console.log('🎉 Test user seeded successfully with HOSPITAL_ADMIN role!');
  } catch (error) {
    console.error('❌ Seeding failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

seedTestData();