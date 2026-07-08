import admin from 'firebase-admin'
import fs from 'fs'

// Initialize Firebase Admin SDK
// Expects GOOGLE_APPLICATION_CREDENTIALS in .env or default service account path
if (!admin.apps.length) {
    try {
        const bucketName = process.env.FIREBASE_STORAGE_BUCKET || 'hospital-ms-25052.appspot.com'
        if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
            const cert = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON)
            admin.initializeApp({
                credential: admin.credential.cert(cert),
                storageBucket: bucketName
            })
            console.log('Firebase Admin Initialized (JSON Env)')
        } else {
            let cert = null;
            try {
                const saPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || './service-account.json';
                cert = JSON.parse(fs.readFileSync(saPath, 'utf8'));
            } catch (fileErr) {
                console.warn('Could not read service account file:', fileErr.message);
            }

            if (cert) {
                admin.initializeApp({
                    credential: admin.credential.cert(cert),
                    storageBucket: bucketName
                })
                console.log(`Firebase Admin Initialized (${cert.project_id})`)
            } else {
                admin.initializeApp({
                    credential: admin.credential.applicationDefault(),
                    storageBucket: bucketName
                })
                console.log('Firebase Admin Initialized (Application Default)')
            }
        }
    } catch (error) {
        console.error('Firebase Admin Initialization Failed:', error)
    }
}

export const db = admin.firestore()
db.settings({ ignoreUndefinedProperties: true })
export const auth = admin.auth()
export default admin
