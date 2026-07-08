import 'dotenv/config';
process.env.FIRESTORE_PREFER_REST = 'true';
import { db } from './src/config/firebase.js';

async function countRecords() {
    const collections = ['users', 'patients', 'appointments', 'doctorprofiles', 'staffs', 'invoices', 'medicines'];
    for (const coll of collections) {
        try {
            const snap = await db.collection(coll).get();
            console.log(`Collection "${coll}" has ${snap.size} documents at root.`);
        } catch (e) {
            console.log(`Collection "${coll}" root fetch failed:`, e.message);
        }
    }
    
    // Also check scoped under a tenant if any exists
    try {
        const tenantsSnap = await db.collection('tenants').get();
        console.log(`Found ${tenantsSnap.size} tenants.`);
        for (const tenantDoc of tenantsSnap.docs) {
            console.log(`Tenant: ${tenantDoc.id} (${tenantDoc.data().name})`);
            const subColls = ['users', 'patients', 'appointments', 'doctorprofiles', 'staffs', 'invoices', 'medicines'];
            for (const sc of subColls) {
                const snap = await db.collection('hospitals').doc(tenantDoc.id).collection(sc).get();
                console.log(`  - Subcollection "${sc}" has ${snap.size} documents.`);
            }
        }
    } catch (e) {
        console.error('Tenant fetch failed:', e.message);
    }
    
    process.exit(0);
}

countRecords().catch(console.error);
