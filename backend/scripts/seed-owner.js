import bcrypt from 'bcryptjs';
import { db } from '../src/config/db.js'; 

async function seedOwner() {
  try {
    console.log('Starting Platform Bootstrap...');

    // Ensure the SYSTEM_OWNER role exists
    let ownerRole = await db.role.findUnique({ where: { name: 'SYSTEM_OWNER' } });
    if (!ownerRole) {
      ownerRole = await db.role.create({
        data: { name: 'SYSTEM_OWNER', description: 'Platform Super Administrator' }
      });
      console.log('Created SYSTEM_OWNER role');
    }

    // Create the Root Platform Tenant
    let platformTenant = await db.tenant.findUnique({ where: { slug: 'system-platform' } });
    if (!platformTenant) {
      platformTenant = await db.tenant.create({
        data: {
          name: 'Platform Administration',
          slug: 'system-platform',
          status: 'active'
        }
      });
      console.log('Created Root Platform Tenant');
    }

    // Create the System Owner User
    const email = process.env.SEED_OWNER_EMAIL;
    const password = process.env.SEED_OWNER_PASSWORD;

    if (!email || !password) {
      throw new Error(
        'SEED_OWNER_EMAIL and SEED_OWNER_PASSWORD must be set in the environment before running this script.'
      );
    }

    const existingUser = await db.users.findFirst({ where: { email } });

    if (existingUser) {
      console.log(`System owner (${email}) already exists.`);
      return;
    }

    const password_hash = await bcrypt.hash(password, 12);

    // Inject the tenant context into the Postgres transaction
    const user = await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${platformTenant.tenant_id}::text, true)`;
      
      return tx.users.create({
        data: {
          tenant_id: platformTenant.tenant_id,
          role_id: ownerRole.role_id,
          name: 'System Owner',
          email: email,
          password_hash,
          must_change_password: false
        }
      });
    });

    console.log('SYSTEM_OWNER account created successfully!');
    console.log('--------------------------------------------------');
    console.log(`Email:    ${email}`);
    console.log('Password: (as provided via SEED_OWNER_PASSWORD)');
    console.log('Slug:     (Leave blank during login)');
    console.log('--------------------------------------------------');

  } catch (err) {
    console.error('Bootstrap Error:', err);
  } finally {
    process.exit(0);
  }
}

seedOwner();