import express from 'express';
import TelemedicineConsultation from '../models/TelemedicineConsultation.js';
import Appointment from '../models/Appointment.js';
import Patient from '../models/Patient.js';
import { protect } from '../utils/auth.js';
import { loadTenant } from '../utils/saas.js';
import { allowRolesWithSubadminFeature } from '../utils/permissions.js';
import { logActivity } from '../utils/auditHelper.js';
import { getCache, setCache } from '../utils/redis.js';

const router = express.Router();

// @desc    Get telemedicine consultations
// @route   GET /api/telemedicine/sessions
router.get('/sessions', protect, loadTenant, async (req, res) => {
    try {
        const tenantId = req.tenant?._id || req.user?.tenantId
        const role = req.user?.role
        const cacheKey = `hms:telemedicine:sessions:${tenantId}:${role}:${req.userId}`
        const cached = await getCache(cacheKey)
        if (cached) {
            return res.json(cached)
        }

        const q = {};
        if (role === 'patient') {
            const patient = await req.db(Patient).findOne({ email: req.user.email });
            if (!patient) return res.json([]);
            q.patient = patient._id;
        } else if (role === 'doctor') {
            q.doctor = req.userId;
        }

        const sessions = await req.db(TelemedicineConsultation).find(q).sort({ createdAt: -1 });
        await setCache(cacheKey, sessions, 30).catch(() => {})
        res.json(sessions);
    } catch (e) {
        res.status(500).json({ error: 'Failed to load telemedicine consultations' });
    }
});

// @desc    Initiate/Create a telemedicine session linked to an appointment
// @route   POST /api/telemedicine/sessions
router.post('/sessions', protect, loadTenant, allowRolesWithSubadminFeature(['admin', 'subadmin', 'doctor'], 'manage_appointments'), async (req, res) => {
    try {
        const { appointmentId } = req.body;
        const tenantId = req.tenant?._id || req.user?.tenantId;

        const appointment = await req.db(Appointment).findById(appointmentId);
        if (!appointment) return res.status(404).json({ error: 'Appointment not found' });

        // Generate mock room and WebRTC credentials
        const roomId = 'ROOM-TELE-' + Date.now().toString().slice(-6);
        const signalToken = 'SIG-TOK-' + Math.random().toString(36).substring(2, 12).toUpperCase();

        const session = await req.db(TelemedicineConsultation).create({
            tenantId,
            appointment: appointmentId,
            patient: appointment.patient,
            patientName: appointment.patientName,
            doctor: appointment.doctor,
            doctorName: appointment.doctorName || 'Consulting Doctor',
            roomId,
            signalToken,
            status: 'initiated', // initiated -> active -> completed -> missed
            callDurationSeconds: 0,
            createdBy: req.userId
        });

        // Link telemedicine room to appointment
        appointment.telemedicineRoomId = roomId;
        await appointment.save();

        await logActivity(req, 'INITIATE_TELECONSULT', 'telemedicineconsultation', session._id, { appointmentId, roomId });
        res.status(201).json(session);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Failed to initiate telemedicine session' });
    }
});

// @desc    Update call notes and mark complete
// @route   PUT /api/telemedicine/sessions/:id/complete
router.put('/sessions/:id/complete', protect, loadTenant, async (req, res) => {
    try {
        const { doctorNotes, callDurationSeconds } = req.body;
        const session = await req.db(TelemedicineConsultation).findById(req.params.id);
        if (!session) return res.status(404).json({ error: 'Teleconsultation session not found' });

        session.doctorNotes = doctorNotes || '';
        session.callDurationSeconds = Number(callDurationSeconds || 0);
        session.status = 'completed';
        session.completedAt = new Date();

        const updated = await session.save();
        await logActivity(req, 'COMPLETE_TELECONSULT', 'telemedicineconsultation', session._id, { duration: callDurationSeconds });
        res.json(updated);
    } catch (e) {
        res.status(500).json({ error: 'Failed to update teleconsultation session' });
    }
});

export default router;
