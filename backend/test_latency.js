import 'dotenv/config';
// process.env.FIRESTORE_PREFER_REST = 'true';
import { db } from './src/config/firebase.js';

async function testLatency() {
    console.log('Starting latency tests...');
    
    const start1 = Date.now();
    try {
        console.log('Querying root "users"...');
        const snap = await db.collection('users').limit(5).get();
        console.log(`Success: fetched ${snap.size} users in ${Date.now() - start1}ms`);
    } catch (e) {
        console.error('Error users query:', e.message, e.code, e.stack);
    }
    
    const start2 = Date.now();
    try {
        console.log('Querying root "patients"...');
        const snap = await db.collection('patients').limit(5).get();
        console.log(`Success: fetched ${snap.size} patients in ${Date.now() - start2}ms`);
    } catch (e) {
        console.error('Error patients query:', e.message, e.code);
    }

    const start3 = Date.now();
    try {
        console.log('Querying root "appointments"...');
        const snap = await db.collection('appointments').limit(5).get();
        console.log(`Success: fetched ${snap.size} appointments in ${Date.now() - start3}ms`);
    } catch (e) {
        console.error('Error appointments query:', e.message, e.code);
    }

    process.exit(0);
}

testLatency().catch(console.error);
