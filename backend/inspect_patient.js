import 'dotenv/config';
process.env.FIRESTORE_PREFER_REST = 'true';
import { db } from './src/config/firebase.js';

async function run() {
  const email = 'manik@gmail.com';
  const tenantId = 'zN6mVN6PktDvZa69CNj3';
  
  // Try querying in the global patients collection first
  const snap1 = await db.collection('patients').where('email', '==', email).get();
  console.log('Global Patients count by email:', snap1.size);
  snap1.docs.forEach(doc => {
    console.log('Global Patient:', doc.id, doc.data());
  });

  // Try querying in the tenant collection
  const snap2 = await db.collection('hospitals').doc(tenantId).collection('patients').where('email', '==', email).get();
  console.log('Tenant Patients count by email:', snap2.size);
  snap2.docs.forEach(doc => {
    console.log('Tenant Patient:', doc.id, doc.data());
  });

  process.exit(0);
}

run().catch(console.error);
