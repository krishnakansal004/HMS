import { db } from '../src/config/db.js'; 

const ROLES = [
  'SYSTEM_OWNER',
  'DIRECTOR',
  'HOSPITAL_ADMIN',
  'RECEPTIONIST',
  'DOCTOR',
  'NURSE',
  'PATIENT',
  'ACCOUNTANT',
  'CASHIER',
  'HR',
  'PHARMACIST',
  'STORE_MANAGER',
  'LAB_TECHNICIAN',
  'RADIOLOGY_TECHNICIAN'
];

async function seedRoles() {
  try {
    console.log('Seeding Master Role Catalog...');
    
    for (const roleName of ROLES) {
      await db.role.upsert({
        where: { name: roleName },
        update: {}, // Do nothing if it already exists
        create: { 
          name: roleName, 
          description: `Standard system role for ${roleName.toLowerCase()}`
        }
      });
      console.log(`Verified/Inserted: ${roleName}`);
    }
    
    console.log('All 14 system roles seeded successfully!');
  } catch (error) {
    console.error('Failed to seed roles:', error);
  } finally {
    await db.$disconnect();
  }
}

seedRoles();