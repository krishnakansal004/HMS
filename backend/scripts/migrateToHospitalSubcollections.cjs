const admin = require('firebase-admin');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
require('dotenv').config();

// Initialize Firebase Admin (assuming default env vars or passing a service account)
const app = admin.initializeApp();
const db = getFirestore();

async function migrateData() {
    console.log('Starting migration to hospital-centric subcollections...');

    // Collections to migrate into hospitals/{hospitalId}/{collectionName}
    const collectionsToMigrate = [
        'users',
        'patients',
        'staffs',
        'appointments',
        'prescriptions',
        'invoices',
        'doctorProfiles',
        'doctorAvailability',
        'doctorAttendance',
        'departments',
        'beds',
        'wards',
        'medicines',
        'suppliers',
        'purchases',
        'expenses',
        'shifts',
        'leaveRequests',
        'queueTokens',
        'attendance',
        'plans',
        'planReceipts',
        'planRequests',
        'settings'
    ];

    // 1. First, make sure we have all tenants copied to hospitals collection
    console.log('\n--- Migrating tenants to hospitals ---');
    const tenantsSnapshot = await db.collection('tenants').get();
    console.log(`Found ${tenantsSnapshot.size} tenants.`);
    
    let tenantCount = 0;
    for (const doc of tenantsSnapshot.docs) {
        await db.collection('hospitals').doc(doc.id).set(doc.data(), { merge: true });
        tenantCount++;
        if (tenantCount % 10 === 0) console.log(`Migrated ${tenantCount} tenants to hospitals...`);
    }

    // 2. Migrate documents from flat collections to subcollections
    for (const collectionName of collectionsToMigrate) {
        console.log(`\n--- Migrating collection: ${collectionName} ---`);
        const snapshot = await db.collection(collectionName).get();
        console.log(`Found ${snapshot.size} documents in ${collectionName}.`);

        let docCount = 0;
        let batch = db.batch();
        let batchSize = 0;

        for (const doc of snapshot.docs) {
            const data = doc.data();
            const tenantId = data.tenantId || data.tenant;
            
            // Skip documents without tenant context
            // Special rule for users: we keep root users for JWT auth, but we also copy them to subcollection
            if (tenantId) {
                const subcollectionRef = db.collection('hospitals').doc(tenantId).collection(collectionName).doc(doc.id);
                batch.set(subcollectionRef, data, { merge: true });
                batchSize++;
                docCount++;

                if (batchSize === 500) {
                    await batch.commit();
                    batch = db.batch();
                    batchSize = 0;
                    console.log(`Committed 500 documents for ${collectionName}...`);
                }
            }
        }
        
        if (batchSize > 0) {
            await batch.commit();
            console.log(`Committed remaining ${batchSize} documents for ${collectionName}...`);
        }
        
        console.log(`Finished migrating ${docCount} documents for ${collectionName}.`);
    }

    console.log('\nMigration complete! 🎉');
}

migrateData().catch(console.error);
