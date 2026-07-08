import { db } from './src/config/firebase.js';

async function run() {
  const snapshot = await db.collection('plans').get();
  snapshot.forEach(async (doc) => {
    const data = doc.data();
    if (data.prices && data.prices.threeMonths === 79900) {
      console.log(`Fixing plan ${doc.id}`);
      await db.collection('plans').doc(doc.id).update({
        'prices.threeMonths': 799900
      });
      console.log('Fixed!');
    }
  });
}

run().catch(console.error);
