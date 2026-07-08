import 'dotenv/config';
process.env.FIRESTORE_PREFER_REST = 'true';
import { db } from './src/config/firebase.js';

async function printDocs() {
    const collections = ['users', 'patients', 'appointments', 'tenants'];
    for (const coll of collections) {
        try {
            const snap = await db.collection(coll).get();
            console.log(`--- ROOT COLLECTION: ${coll} (${snap.size} docs) ---`);
            snap.docs.forEach(doc => {
                console.log(`Doc ID: ${doc.id}`);
                console.log(JSON.stringify(doc.data(), null, 2));
            });
        } catch (e) {
            console.log(`Failed to print ${coll}:`, e.message);
        }
    }
    process.exit(0);
}

printDocs().catch(console.error);
