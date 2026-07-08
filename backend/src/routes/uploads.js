import express from 'express'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import jwt from 'jsonwebtoken'
import User from '../models/User.js'
import Patient from '../models/Patient.js'
import Prescription from '../models/Prescription.js'

const router = express.Router()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const UPLOADS_DIR = path.resolve(__dirname, '../../uploads')

// Helper middleware to authenticate upload requests via cookie OR auth header.
// Normal imgs/pdfs don't send auth headers, so we rely heavily on the refreshToken cookie.
async function authUpload(req, res, next) {
    let token = req.cookies?.refreshToken

    // Fallback to Authorization header if present
    if (!token && req.headers.authorization?.startsWith('Bearer ')) {
        token = req.headers.authorization.slice(7)
    }

    if (!token) return res.status(401).send('Unauthorized')

    try {
        // Try refreshing secret first (cookie token), then access secret (header token)
        let payload = null;
        try {
            payload = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET)
        } catch (e) {
            if (req.headers.authorization) {
                payload = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET)
            } else {
                throw e;
            }
        }

        // Include tenantId from the database for verification
        const user = await User.findById(payload.sub).select('tenantId role')
        if (!user) return res.status(401).send('Unauthorized')

        req.user = user
        next()
    } catch (err) {
        console.error('[UploadAuth] Token verification failed', err)
        return res.status(401).send('Unauthorized')
    }
}

router.use(authUpload)

// Generic function to safely resolve paths and prevent directory traversal
function safeResolve(baseDir, reqPath) {
    // Decode the URL path to handle %20 etc.
    const decodedPath = decodeURIComponent(reqPath)
    const fullPath = path.resolve(baseDir, decodedPath)

    // Ensure the resolved path actually starts with the intended base directory
    if (!fullPath.startsWith(baseDir)) {
        throw new Error('Directory traversal attempt detected')
    }
    return fullPath
}

// Protect /uploads/avatars/*
router.get('/avatars/:filename', async (req, res) => {
    try {
        if (req.user.role === 'director') {
            // Directors can see all avatars
            const target = safeResolve(path.join(UPLOADS_DIR, 'avatars'), req.params.filename)
            if (fs.existsSync(target)) return res.sendFile(target)
            return res.status(404).send('Not Found')
        }

        const patient = await req.db(Patient).findOne({ avatarUrl: `/uploads/avatars/${req.params.filename}` })
        if (!patient) return res.status(404).send('Not Found')

        if (String(patient.tenantId) !== String(req.user.tenantId)) {
            return res.status(403).send('Forbidden: Tenant mismatch')
        }

        const target = safeResolve(path.join(UPLOADS_DIR, 'avatars'), req.params.filename)
        if (fs.existsSync(target)) return res.sendFile(target)
        return res.status(404).send('Not Found')
    } catch (e) {
        return res.status(400).send('Bad Request')
    }
})

// Protect /uploads/reports/*
router.get('/reports/:filename', async (req, res) => {
    try {
        if (req.user.role === 'director') {
            const target = safeResolve(path.join(UPLOADS_DIR, 'reports'), req.params.filename)
            if (fs.existsSync(target)) return res.sendFile(target)
            return res.status(404).send('Not Found')
        }

        // Reports are stored in patient arrays. We need to find if any patient of this tenant has this report
        const patientUrl = `/uploads/reports/${req.params.filename}`
        const patient = await req.db(Patient).findOne({ 'reports.url': patientUrl })

        if (!patient) return res.status(404).send('Not Found')

        if (String(patient.tenantId) !== String(req.user.tenantId)) {
            return res.status(403).send('Forbidden: Tenant mismatch')
        }

        const target = safeResolve(path.join(UPLOADS_DIR, 'reports'), req.params.filename)
        if (fs.existsSync(target)) return res.sendFile(target)
        return res.status(404).send('Not Found')
    } catch (e) {
        return res.status(400).send('Bad Request')
    }
})

// Protect /uploads/prescriptions/*
router.get('/prescriptions/:filename', async (req, res) => {
    try {
        if (req.user.role === 'director') {
            const target = safeResolve(path.join(UPLOADS_DIR, 'prescriptions'), req.params.filename)
            if (fs.existsSync(target)) return res.sendFile(target)
            return res.status(404).send('Not Found')
        }

        // Prescription filenames are <id>.pdf
        const presId = req.params.filename.replace('.pdf', '')
        const pres = await req.db(Prescription).findById(presId).select('tenantId')

        if (!pres) return res.status(404).send('Not Found')

        if (String(pres.tenantId) !== String(req.user.tenantId)) {
            return res.status(403).send('Forbidden: Tenant mismatch')
        }

        const target = safeResolve(path.join(UPLOADS_DIR, 'prescriptions'), req.params.filename)
        if (fs.existsSync(target)) return res.sendFile(target)
        return res.status(404).send('Not Found')
    } catch (e) {
        return res.status(400).send('Bad Request')
    }
})

// Protect /uploads/plan-requests/*
router.get('/plan-requests/:date/:filename', async (req, res) => {
    try {
        // Only directors can see plan request doc uploads
        if (req.user.role !== 'director') {
            return res.status(403).send('Forbidden: Only directors can access these documents')
        }

        const baseDir = path.join(UPLOADS_DIR, 'plan-requests', req.params.date)
        const target = safeResolve(baseDir, req.params.filename)

        if (fs.existsSync(target)) return res.sendFile(target)
        return res.status(404).send('Not Found')
    } catch (e) {
        return res.status(400).send('Bad Request')
    }
})

export default router
