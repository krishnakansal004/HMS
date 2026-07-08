import 'dotenv/config';
process.env.FIRESTORE_PREFER_REST = 'true';
import { db } from './src/config/firebase.js';

async function run() {
  const userId = '2UlWMhzrPqdmH9ZGToJR';
  const userDoc = await db.collection('users').doc(userId).get();
  console.log('User:', userDoc.exists ? userDoc.data() : 'not found');

  const snap = await db.collection('patients').where('user', '==', userId).get();
  console.log('Patients count:', snap.size);
  snap.docs.forEach(doc => {
    console.log('Patient doc:', doc.id, doc.data());
  });
  
  process.exit(0);
}

run().catch(console.error);
