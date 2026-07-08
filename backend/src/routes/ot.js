import express from 'express';
import OTSchedule from '../models/OTSchedule.js';
import Patient from '../models/Patient.js';
import User from '../models/User.js';
import { protect } from '../utils/auth.js';
import { loadTenant } from '../utils/saas.js';
import { allowRolesWithSubadminFeature } from '../utils/permissions.js';
import { logActivity } from '../utils/auditHelper.js';
import { postBillingCharge } from '../utils/billingHelper.js';
import { getCache, setCache } from '../utils/redis.js';

const router = express.Router();

// @desc    Get all scheduled surgeries
// @route   GET /api/ot/schedules
router.get('/schedules', protect, loadTenant, async (req, res) => {
    try {
        const tenantId = req.tenant?._id || req.user?.tenantId
        const role = req.user?.role
        const cacheKey = `hms:ot:schedules:${tenantId}:${role}:${req.userId}`
        const cached = await getCache(cacheKey)
        if (cached) {
            return res.json(cached)
        }

        const q = {};
        if (role === 'patient') {
            if (!req.user?.email) return res.json([]);
            const patient = await req.db(Patient).findOne({ email: req.user.email });
            if (!patient) return res.json([]);
            q.patient = patient._id;
        }

        const schedules = await req.db(OTSchedule).find(q).sort({ scheduledTime: 1 });
        await setCache(cacheKey, schedules, 30).catch(() => {})
        res.json(schedules);
    } catch (e) {
        res.status(500).json({ error: 'Failed to load OT schedule' });
    }
});

// @desc    Schedule a surgery
// @route   POST /api/ot/schedules
router.post('/schedules', protect, loadTenant, allowRolesWithSubadminFeature(['admin', 'subadmin', 'doctor'], 'manage_ot'), async (req, res) => {
    try {
        const { patientId, surgeonId, anesthetistId, scheduledTime, durationMinutes, procedure, otRoom } = req.body;
        const tenantId = req.tenant?._id || req.user?.tenantId;

        const [patient, surgeon, anesthetist] = await Promise.all([
            req.db(Patient).findById(patientId),
            User.findById(surgeonId),
            User.findById(anesthetistId)
        ]);

        if (!patient) return res.status(404).json({ error: 'Patient not found' });
        const surgeonName = surgeon ? surgeon.name : 'Assigned Surgeon';
        const anesthetistName = anesthetist ? anesthetist.name : 'Assigned Anesthetist';

        const schedule = await req.db(OTSchedule).create({
            tenantId,
            patient: patientId,
            patientName: `${patient.firstName} ${patient.lastName}`,
            surgeon: surgeonId,
            surgeonName,
            anesthetist: anesthetistId,
            anesthetistName,
            scheduledTime: new Date(scheduledTime),
            durationMinutes: Number(durationMinutes || 60),
            procedure, // e.g. Appendectomy, Coronary Bypass
            otRoom: otRoom || 'OT Room 1',
            status: 'scheduled', // scheduled -> ongoing -> completed -> cancelled
            notes: {},
            price: Number(req.body.price || 5000),
            createdBy: req.userId,
            billingStatus: 'pending'
        });

        await logActivity(req, 'SCHEDULE_SURGERY', 'otschedule', schedule._id, { patientId, surgeonId, procedure });
        res.status(201).json(schedule);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Failed to schedule OT surgery' });
    }
});

// @desc    Save preoperative & postoperative OT notes
// @route   POST /api/ot/schedules/:id/notes
router.post('/schedules/:id/notes', protect, loadTenant, allowRolesWithSubadminFeature(['admin', 'subadmin', 'doctor'], 'manage_ot'), async (req, res) => {
    try {
        const { preoperativeDiagnosis, postoperativeDiagnosis, procedurePerformed, surgeryNotes, anesthetistNotes } = req.body;
        const schedule = await req.db(OTSchedule).findById(req.params.id);
        if (!schedule) return res.status(404).json({ error: 'OT Schedule not found' });

        schedule.notes = {
            preoperativeDiagnosis,
            postoperativeDiagnosis,
            procedurePerformed,
            surgeryNotes,
            anesthetistNotes,
            updatedAt: new Date()
        };
        schedule.status = 'ongoing';

        const updated = await schedule.save();
        await logActivity(req, 'SAVE_SURGERY_NOTES', 'otschedule', schedule._id);
        res.json(updated);
    } catch (e) {
        res.status(500).json({ error: 'Failed to record OT notes' });
    }
});

// @desc    Complete surgery and post billing charge
// @route   POST /api/ot/schedules/:id/complete
router.post('/schedules/:id/complete', protect, loadTenant, allowRolesWithSubadminFeature(['admin', 'subadmin', 'doctor'], 'manage_ot'), async (req, res) => {
    try {
        const schedule = await req.db(OTSchedule).findById(req.params.id);
        if (!schedule) return res.status(404).json({ error: 'OT Schedule not found' });

        schedule.status = 'completed';
        schedule.completedAt = new Date();

        // ─── BILLING INTEGRATION: Post OT Charge ──────────────────────────────
        if (schedule.price > 0) {
            await postBillingCharge(req, schedule.patient, `OT Surgery Fee: ${schedule.procedure}`, schedule.price);
            schedule.billingStatus = 'billed';
        }

        const updated = await schedule.save();
        
        // Push to patient clinical timeline (simulated by updating patient history)
        const patient = await req.db(Patient).findById(schedule.patient);
        if (patient) {
            const history = Array.isArray(patient.medicalHistory) ? patient.medicalHistory : [];
            history.push(`Surgery Performed: ${schedule.procedure} on ${schedule.completedAt.toLocaleDateString()} (Surgeon: ${schedule.surgeonName})`);
            patient.medicalHistory = history;
            await patient.save();
        }

        await logActivity(req, 'COMPLETE_SURGERY', 'otschedule', schedule._id);
        res.json(updated);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Failed to complete OT surgery' });
    }
});

export default router;
