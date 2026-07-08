import express from 'express';
import AbdmConsent from '../models/AbdmConsent.js';
import Patient from '../models/Patient.js';
import { protect } from '../utils/auth.js';
import { loadTenant } from '../utils/saas.js';
import { allowRolesWithSubadminFeature } from '../utils/permissions.js';
import { logActivity } from '../utils/auditHelper.js';

const router = express.Router();

// @desc    Simulate ABHA ID OTP Generation
// @route   POST /api/abdm/verify-abha/otp
router.post('/verify-abha/otp', protect, loadTenant, async (req, res) => {
    try {
        const { abhaId } = req.body;
        if (!abhaId) return res.status(400).json({ error: 'ABHA ID or Address is required' });

        // Simulate sending OTP via UIDAI
        const txnId = 'ABHA-TXN-' + Math.floor(Math.random() * 900000 + 100000);
        res.json({
            message: 'OTP sent successfully to registered Aadhaar mobile number',
            txnId,
            maskedPhone: 'XXXXXX9876'
        });
    } catch (e) {
        res.status(500).json({ error: 'ABHA verification service unavailable' });
    }
});

// @desc    Simulate ABHA ID Verification with OTP
// @route   POST /api/abdm/verify-abha/confirm
router.post('/verify-abha/confirm', protect, loadTenant, async (req, res) => {
    try {
        const { abhaId, otp, txnId } = req.body;
        if (!abhaId || !otp || !txnId) {
            return res.status(400).json({ error: 'ABHA ID, OTP, and transaction ID are required' });
        }

        if (otp !== '123456') { // Mock verification rule
            return res.status(400).json({ error: 'Invalid OTP. Please enter 123456 for simulator validation.' });
        }

        // Return verified profile details
        res.json({
            verified: true,
            abhaDetails: {
                abhaNumber: '12-3456-7890-1234',
                abhaAddress: abhaId.includes('@') ? abhaId : `${abhaId}@sbx`,
                name: 'Karan Sharma',
                gender: 'M',
                dob: '1990-08-15',
                phone: '+919876543210',
                address: 'Sector 62, Noida, Uttar Pradesh'
            }
        });
    } catch (e) {
        res.status(500).json({ error: 'ABHA confirmation service timeout' });
    }
});


// ─── CONSENT MANAGEMENT ──────────────────────────────────────────────────

// @desc    Get consent requests
// @route   GET /api/abdm/consents
router.get('/consents', protect, loadTenant, async (req, res) => {
    try {
        const q = {};
        if (req.user?.role === 'patient') {
            const patient = await req.db(Patient).findOne({ email: req.user.email });
            if (!patient) return res.json([]);
            q.patient = patient._id;
        }

        const consents = await req.db(AbdmConsent).find(q).sort({ createdAt: -1 });
        res.json(consents);
    } catch (e) {
        res.status(500).json({ error: 'Failed to load consent logs' });
    }
});

// @desc    Create consent request
// @route   POST /api/abdm/consents
router.post('/consents', protect, loadTenant, allowRolesWithSubadminFeature(['admin', 'subadmin', 'doctor'], 'manage_abdm'), async (req, res) => {
    try {
        const { patientId, purpose, dataTypes, expiry } = req.body;
        const tenantId = req.tenant?._id || req.user?.tenantId;

        const patient = await req.db(Patient).findById(patientId);
        if (!patient) return res.status(404).json({ error: 'Patient not found' });

        const consentId = 'CONS-' + Date.now().toString().slice(-8);

        const consent = await req.db(AbdmConsent).create({
            tenantId,
            consentId,
            patient: patientId,
            patientName: `${patient.firstName} ${patient.lastName}`,
            purpose: purpose || 'Clinical Consult',
            dataTypes: dataTypes || ['OPD', 'Prescription', 'LIS'],
            expiry: expiry ? new Date(expiry) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Default 30 days
            status: 'requested', // requested -> granted -> denied -> expired
            createdBy: req.userId
        });

        await logActivity(req, 'REQUEST_ABDM_CONSENT', 'abdmconsent', consent._id, { patientId, consentId });
        res.status(201).json(consent);
    } catch (e) {
        res.status(500).json({ error: 'Failed to create consent request' });
    }
});

// @desc    Approve/Deny consent (Patient self view)
// @route   PUT /api/abdm/consents/:id/status
router.put('/consents/:id/status', protect, loadTenant, async (req, res) => {
    try {
        const { status } = req.body; // granted | denied
        const consent = await req.db(AbdmConsent).findById(req.params.id);
        if (!consent) return res.status(404).json({ error: 'Consent log not found' });

        consent.status = status;
        if (status === 'granted') {
            consent.grantedAt = new Date();
        }

        const updated = await consent.save();
        await logActivity(req, 'UPDATE_ABDM_CONSENT_STATUS', 'abdmconsent', consent._id, { status });
        res.json(updated);
    } catch (e) {
        res.status(500).json({ error: 'Failed to update consent status' });
    }
});


// ─── HEALTH RECORD SYNC ──────────────────────────────────────────────────

// @desc    Simulate sync health record to ABDM gateway (FHIR bundle)
// @route   POST /api/abdm/sync-records
router.post('/sync-records', protect, loadTenant, allowRolesWithSubadminFeature(['admin', 'subadmin', 'doctor'], 'manage_abdm'), async (req, res) => {
    try {
        const { patientId, recordType, recordId } = req.body;
        
        const patient = await req.db(Patient).findById(patientId);
        if (!patient) return res.status(404).json({ error: 'Patient not found' });

        // Generate mock FHIR bundle transaction ID
        const bundleId = 'FHIR-BND-' + Date.now().toString().slice(-6) + Math.floor(Math.random() * 100);

        await logActivity(req, 'SYNC_ABDM_HEALTH_RECORD', 'abdmrecord', recordId, { patientId, recordType, bundleId });
        res.json({
            success: true,
            message: 'Health record successfully compiled into FHIR bundle and synced with NDHM Health Information Provider (HIP) gateway.',
            bundleId,
            timestamp: new Date()
        });
    } catch (e) {
        res.status(500).json({ error: 'Failed to sync health records' });
    }
});

export default router;
