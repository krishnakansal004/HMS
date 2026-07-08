import 'dotenv/config';
process.env.FIRESTORE_PREFER_REST = 'true';
import { db } from './src/config/firebase.js';

async function run() {
  const doctorId = 'Iaf2nyFyI8qSqmsbBcbY';
  const tenantId = 'zN6mVN6PktDvZa69CNj3';
  
  const doc = await db.collection('users').doc(doctorId).get();
  console.log('Doctor User Doc:', doc.exists ? doc.data() : 'not found');

  const profileSnap = await db.collection('hospitals').doc(tenantId).collection('doctorprofiles').where('user', '==', doctorId).get();
  console.log('Doctor Profile count:', profileSnap.size);
  profileSnap.docs.forEach(d => {
    console.log('Doctor Profile Doc:', d.id, d.data());
  });

  process.exit(0);
}

run().catch(console.error);
