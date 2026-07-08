import { db } from './src/config/firebase.js';

async function run() {
  const snapshot = await db.collection('plans').get();
  snapshot.forEach(doc => {
    console.log(doc.id, '=>', JSON.stringify(doc.data(), null, 2));
  });
}

run().catch(console.error);
