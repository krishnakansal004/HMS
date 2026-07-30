import admin from 'firebase-admin'
import fs from 'fs'

const bucketName = process.env.FIREBASE_STORAGE_BUCKET || 'hospital-ms-25052.appspot.com'

function loadFirebaseCredentials() {
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
        try {
            return JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON)
        } catch (err) {
            throw new Error(`Invalid JSON in GOOGLE_APPLICATION_CREDENTIALS_JSON: ${err.message}`)
        }
    }

    const saPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || './service-account.json'
    try {
        return JSON.parse(fs.readFileSync(saPath, 'utf8'))
    } catch (err) {
        if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
            throw new Error(`Failed to read service account file from ${saPath}: ${err.message}`)
        }
        return null
    }
}

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
    try {
        const cert = loadFirebaseCredentials()
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
    } catch (error) {
        console.error('Firebase Admin Initialization Failed:', error)
        throw error
    }
}

export const db = admin.firestore()
db.settings({ ignoreUndefinedProperties: true })
export const auth = admin.auth()
export default admin
