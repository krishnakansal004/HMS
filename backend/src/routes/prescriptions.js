import express from 'express';
import Prescription from '../models/Prescription.js';
import Patient from '../models/Patient.js';
import Medicine from '../models/Medicine.js';
import { protect, doctor, patient as patientRole, admin } from '../utils/auth.js';
import User from '../models/User.js';
import PrescriptionTemplate from '../models/PrescriptionTemplate.js';
import { sendEmail } from '../utils/notify.js';
import PaymentRequest from '../models/PaymentRequest.js'
import Invoice from '../models/Invoice.js'
import Razorpay from 'razorpay'
import fs from 'fs'
import path from 'path'
import PDFDocument from 'pdfkit'
import tenantMiddleware from '../utils/tenant.js'
import { uploadToCloudinary } from '../config/cloudinary.js'
import { allowRolesWithSubadminFeature } from '../utils/permissions.js'
import { triggerBackgroundUpdate } from '../services/cacheService.js'

const router = express.Router();

// @desc    Create a new prescription
// @route   POST /api/prescriptions
// @access  Private/Doctor
router.post('/', protect, doctor, tenantMiddleware, async (req, res) => {
    try {
        console.log('[Prescriptions] Incoming create prescription body:', req.body);
        const { patientId, patientName, patientEmail, medicines, tests, notes, followUp } = req.body;

        // basic validation: ensure there's something to prescribe
        if ((!medicines || medicines.length === 0) && (!tests || tests.length === 0)) {
            console.warn('[Prescriptions] Validation error: No medicines or tests provided');
            return res.status(400).json({ error: 'Prescription must contain at least one medicine or test' });
        }

        if (!patientName) {
            console.warn('[Prescriptions] Validation error: Patient name required');
            return res.status(400).json({ error: 'Patient name required' });
        }

        const tenantId = req.tenant ? req.tenant._id : (req.user ? req.user.tenantId : undefined)
        const prescription = req.db(Prescription)._wrap({
            patient: patientId || undefined,
            patientName: patientName || undefined,
            patientEmail: patientEmail || undefined,
            tenantId,
            doctor: req.userId,
            medicines,
            tests,
            notes,
            followUp,
            approvalStatus: 'pending'
        });
        const createdPrescription = await prescription.save();

        // If we have a patientId, link prescription to the patient record
        if (patientId) {
            const patient = await req.db(Patient).findById(patientId);
            if (patient) {
                patient.prescriptions = Array.isArray(patient.prescriptions) ? patient.prescriptions : [];
                patient.prescriptions.push(createdPrescription._id);
                await patient.save();
            }
        }

        triggerBackgroundUpdate(tenantId);
        res.status(201).json(createdPrescription);
    } catch (e) {
        console.error('Error creating prescription', e, { userId: req.userId, body: req.body });
        res.status(500).json({ error: 'Server error' });
    }
});

// @desc    List all prescriptions (admin/subadmin with permission)
// @route   GET /api/prescriptions
// @access  Private/Admin or permitted Subadmin
router.get('/', protect, tenantMiddleware, allowRolesWithSubadminFeature(['admin', 'director', 'subadmin'], 'manage_prescriptions'), async (req, res) => {
    const tenantId = req.tenant ? req.tenant._id : (req.user ? req.user.tenantId : undefined)
    const q = {}
    if (tenantId) q.tenantId = tenantId
    const prescriptions = await req.db(Prescription).find(q)
        .populate('doctor', 'name')
        .populate('patient', 'firstName lastName email')
        .sort({ createdAt: -1 });
    res.json(prescriptions);
});

// @desc    List prescriptions created by the logged-in doctor
// @route   GET /api/prescriptions/doctor
// @access  Private/Doctor
router.get('/doctor', protect, tenantMiddleware, doctor, async (req, res) => {
    try {
        // Relaxed filter: Allow doctors to see ALL their prescriptions regardless of tenant mismatch
        // const tenantId = req.tenant ? req.tenant._id : (req.user ? req.user.tenantId : undefined)
        const q = { doctor: req.userId }
        // if (tenantId) q.tenantId = tenantId
        const prescriptions = await req.db(Prescription).find(q).populate('patient', 'firstName lastName email').populate('doctor', 'name').sort({ updatedAt: -1 })
        res.json(prescriptions)
    } catch (e) {
        console.error(e)
        res.status(500).json({ error: 'Server error' })
    }
})

// Admin approve prescription
router.post('/:id/approve', protect, allowRolesWithSubadminFeature(['admin', 'director', 'subadmin'], 'manage_prescriptions'), async (req, res) => {
    const tenantId = req.tenant ? req.tenant._id : (req.user ? req.user.tenantId : undefined)
    const pres = await req.db(Prescription).findOne({ _id: req.params.id, ...(tenantId ? { tenantId } : {}) });
    if (!pres) return res.status(404).json({ error: 'Prescription not found' });
    if (pres.approvalStatus !== 'pending') return res.status(400).json({ error: 'Already processed' });
    pres.approvalStatus = 'approved';
    await pres.save();
    res.json({ ok: true });
});

// Admin reject prescription
router.post('/:id/reject', protect, allowRolesWithSubadminFeature(['admin', 'director', 'subadmin'], 'manage_prescriptions'), async (req, res) => {
    const tenantId = req.tenant ? req.tenant._id : (req.user ? req.user.tenantId : undefined)
    const pres = await req.db(Prescription).findOne({ _id: req.params.id, ...(tenantId ? { tenantId } : {}) });
    if (!pres) return res.status(404).json({ error: 'Prescription not found' });
    if (pres.approvalStatus !== 'pending') return res.status(400).json({ error: 'Already processed' });
    pres.approvalStatus = 'rejected';
    await pres.save();
    res.json({ ok: true });
});

// @desc    Get prescriptions for the logged-in patient
// @route   GET /api/prescriptions/mine
// @access  Private/Patient
router.get('/mine', protect, patientRole, async (req, res) => {
    try {
        // Find the user to map to a patient via email
        const user = await User.findById(req.userId).select('email')
        if (!user) return res.status(404).json({ error: 'User not found' })

        // Map by email (no explicit user<->patient link in schema)
        const patient = await req.db(Patient).findOne({ email: user.email }).select('_id')

        let query1 = []
        if (user.email) {
            query1 = await req.db(Prescription).find({ patientEmail: user.email })
                .populate('doctor', 'name')
                .populate('patient', 'firstName lastName email')
        }

        let query2 = []
        if (patient && patient._id) {
            query2 = await req.db(Prescription).find({ patient: patient._id })
                .populate('doctor', 'name')
                .populate('patient', 'firstName lastName email')
        }

        const mergedMap = new Map()
        query1.forEach(p => mergedMap.set(String(p._id || p.id), p))
        query2.forEach(p => mergedMap.set(String(p._id || p.id), p))
        let prescriptions = Array.from(mergedMap.values())

        prescriptions = prescriptions.filter(p => p.hiddenByPatient !== true)

        prescriptions.sort((a, b) => {
            const aTime = new Date(a.updatedAt || a.createdAt).getTime()
            const bTime = new Date(b.updatedAt || b.createdAt).getTime()
            return bTime - aTime
        })

        // Deduplicate algorithm: keep only the latest prescription per doctor+patient pair when multiple
        // prescriptions were created/updated within a short window (e.g., 5 minutes). This handles the
        // common case where a draft is created then immediately edited/sent, producing two records.
        const DUP_WINDOW_MS = 5 * 60 * 1000 // 5 minutes
        const kept = []
        const seen = {} // key -> timestamp (ms)
        for (const p of prescriptions) {
            const patientKey = p.patient ? String(p.patient._id || p.patient.id || p.patient) : (p.patientEmail || '')
            const doctorKey = p.doctor ? String(p.doctor._id || p.doctor.id || p.doctor) : String(p.doctor || '')
            const key = `${doctorKey}_${patientKey}`
            const ts = new Date(p.updatedAt || p.createdAt).getTime()
            if (seen[key] && (seen[key] - ts) <= DUP_WINDOW_MS) {
                // older duplicate within window -> skip
                continue
            }
            // keep this one and mark timestamp
            kept.push(p)
            seen[key] = ts
        }

        res.json(kept)
    } catch (e) {
        console.error('prescriptions/mine error', e)
        res.status(500).json({ error: 'Failed to load prescriptions' })
    }
});

// Patient hide their prescription from patient view
router.patch('/:id/hide', protect, patientRole, async (req, res) => {
    try {
        const tenantId = req.tenant ? req.tenant._id : (req.user ? req.user.tenantId : undefined)
        const pres = await req.db(Prescription).findOne({ _id: req.params.id, ...(tenantId ? { tenantId } : {}) })
        if (!pres) return res.status(404).json({ error: 'Prescription not found' })
        const user = await User.findById(req.userId).select('email')
        if (!user) return res.status(404).json({ error: 'User not found' })
        const ownsByEmail = pres.patientEmail && user.email && pres.patientEmail.toLowerCase() === user.email.toLowerCase()
        const ownsByPatient = pres.patient && String(pres.patient) === String(req.userId)
        if (!ownsByEmail && !ownsByPatient) return res.status(403).json({ error: 'Forbidden' })
        pres.hiddenByPatient = true
        await pres.save()
        res.json({ ok: true })
    } catch (e) {
        console.error(e)
        res.status(500).json({ error: 'Server error' })
    }
})

// @desc    Get a single prescription by ID
// @route   GET /api/prescriptions/:id
// @access  Private
router.get('/:id', protect, tenantMiddleware, async (req, res) => {
    try {
        const tenantId = req.tenant ? req.tenant._id : (req.user ? req.user.tenantId : undefined)
        const q = { _id: req.params.id }
        if (tenantId) q.tenantId = tenantId

        const prescription = await req.db(Prescription).findOne(q)
            .populate('doctor', 'name')
            .populate('patient', 'firstName lastName email');

        if (!prescription) return res.status(404).json({ error: 'Prescription not found' });

        // Enforce role-based access
        const role = req.userRole || req.user?.role;
        if (role === 'patient') {
            const user = await User.findById(req.userId).select('email');
            const patient = await req.db(Patient).findOne({ email: user.email }).select('_id');
            const isOwner = (prescription.patientEmail && user.email && prescription.patientEmail.toLowerCase() === user.email.toLowerCase()) ||
                            (prescription.patient && patient && String(prescription.patient._id || prescription.patient) === String(patient._id));
            if (!isOwner) {
                return res.status(403).json({ error: 'Access denied: You can only view your own prescriptions' });
            }
        } else if (role === 'doctor') {
            // Ensure patient is assigned to the doctor (doctor is the creator or has appointment)
            if (String(prescription.doctor?._id || prescription.doctor) !== String(req.userId)) {
                const Appointment = (await import('../models/Appointment.js')).default;
                const hasAppointment = await req.db(Appointment).findOne({ doctor: req.userId, patient: prescription.patient?._id || prescription.patient || 'none' });
                if (!hasAppointment) {
                    return res.status(403).json({ error: 'Access denied: Patient is not assigned to you' });
                }
            }
        }

        res.json(prescription);
    } catch (e) {
        console.error('Error fetching prescription', e);
        res.status(500).json({ error: 'Server error' });
    }
});

// @desc    Get prescriptions for a patient
// @route   GET /api/prescriptions/patient/:patientId
// @access  Private/Doctor
router.get('/patient/:patientId', protect, doctor, async (req, res) => {
    try {
        // Enforce role-based access: Ensure doctor is assigned to patient
        if (req.userRole === 'doctor') {
            const Appointment = (await import('../models/Appointment.js')).default;
            const hasAppointment = await req.db(Appointment).findOne({ doctor: req.userId, patient: req.params.patientId });
            if (!hasAppointment) {
                return res.status(403).json({ error: 'Access denied: Patient is not assigned to you' });
            }
        }
        const prescriptions = await req.db(Prescription).find({ patient: req.params.patientId }).populate('doctor', 'name');
        res.json(prescriptions);
    } catch (e) {
        console.error('prescriptions/patient error', e)
        res.status(500).json({ error: 'Server error' })
    }
});

// @desc    Update prescription status (e.g., pharmacy issued)
// @route   PUT /api/prescriptions/:id/status
// @access  Private/Doctor
router.put('/:id/status', protect, doctor, async (req, res) => {
    try {
        const { status } = req.body;
        const prescription = await req.db(Prescription).findById(req.params.id);
        if (prescription) {
            prescription.pharmacyStatus = status;
            const updatedPrescription = await prescription.save();
            res.json(updatedPrescription);
        } else {
            res.status(404).json({ error: 'Prescription not found' });
        }
    } catch (e) {
        console.error('prescriptions/status error', e)
        res.status(500).json({ error: 'Server error' })
    }
});

// @desc    Issue prescription (deduct stock) & mark issued
// @route   POST /api/prescriptions/:id/issue
// @access  Private/Doctor
router.post('/:id/issue', protect, doctor, async (req, res) => {
    try {
        const prescription = await req.db(Prescription).findById(req.params.id).populate('medicines.medicine');
        if (!prescription) return res.status(404).json({ error: 'Prescription not found' });
        if (prescription.approvalStatus !== 'approved') return res.status(403).json({ error: 'Prescription not approved by admin' });
        if (prescription.pharmacyStatus === 'issued') return res.status(400).json({ error: 'Already issued' });

        const parseFrequencyPerDay = (f) => {
            if (!f) return 1;
            const lower = f.toLowerCase().trim();
            if (/^\d+(?:-\d+)+$/.test(lower)) {
                return lower.split('-').reduce((sum, part) => sum + (parseInt(part, 10) || 0), 0);
            }
            if (/^\d+$/.test(lower)) return parseInt(lower, 10);
            if (['od', 'daily', 'once'].includes(lower)) return 1;
            if (['bd', 'twice'].includes(lower)) return 2;
            if (['tid', 'thrice'].includes(lower)) return 3;
            if (['qid', 'four'].includes(lower)) return 4;
            const everyMatch = lower.match(/every\s*(\d+)\s*h/); // every 8 h
            if (everyMatch) { const h = parseInt(everyMatch[1], 10); return h ? Math.round(24 / h) : 1; }
            const qhMatch = lower.match(/q(\d+)h/); // q8h
            if (qhMatch) { const h = parseInt(qhMatch[1], 10); return h ? Math.round(24 / h) : 1; }
            return 1;
        };

        const parseDurationDays = (d) => {
            if (!d) return 1;
            const lower = d.toLowerCase().trim();
            const weekMatch = lower.match(/(\d+)\s*week/);
            if (weekMatch) return parseInt(weekMatch[1], 10) * 7;
            const dayMatch = lower.match(/(\d+)\s*d(?:ay|ays)?/);
            if (dayMatch) return parseInt(dayMatch[1], 10);
            if (/^\d+$/.test(lower)) return parseInt(lower, 10);
            return 1;
        };

        const parseTabletsPerDose = (dosage) => {
            if (!dosage) return 1;
            const match = dosage.trim().match(/^(\d+)/);
            if (match) return parseInt(match[1], 10) || 1;
            return 1;
        };

        // Compute required quantities
        const deductions = [];
        const medicineDocs = await Promise.all(prescription.medicines.map(async (item) => {
            if (item.medicine) return item.medicine;
            return req.db(Medicine).findOne({ name: item.name });
        }));

        for (let idx = 0; idx < prescription.medicines.length; idx++) {
            const item = prescription.medicines[idx];
            const medDoc = medicineDocs[idx];
            const freqPerDay = parseFrequencyPerDay(item.frequency);
            const durationDays = parseDurationDays(item.duration);
            const tabletsPerDose = parseTabletsPerDose(item.dosage);
            const totalUnits = freqPerDay * durationDays * tabletsPerDose;
            if (medDoc) {
                deductions.push({ medDoc, totalUnits, displayName: medDoc.name || item.name });
            } else {
                // If not found, skip stock deduction but still record dispensed name
                deductions.push({ medDoc: null, totalUnits: 0, displayName: item.name });
            }
        }

        const insufficient = deductions.filter(d => d.medDoc && (d.medDoc.quantity || 0) < d.totalUnits);
        if (insufficient.length) {
            return res.status(400).json({ error: 'Insufficient stock', details: insufficient.map(i => ({ medicine: i.displayName, needed: i.totalUnits, available: i.medDoc.quantity })) });
        }

        // Bulk decrement in parallel
        const updatePromises = [];
        for (const d of deductions) {
          if (d.medDoc && d.totalUnits > 0) {
            const currentQty = Number(d.medDoc.quantity) || 0;
            updatePromises.push(Medicine.update(d.medDoc._id, { quantity: currentQty - d.totalUnits }));
          }
        }
        if (updatePromises.length > 0) {
          await Promise.all(updatePromises);
        }

        prescription.pharmacyStatus = 'issued';
        prescription.pharmacyIssuedAt = new Date();
        prescription.dispensedItems = deductions.map(d => ({
            medicine: d.medDoc ? d.medDoc._id : undefined,
            name: d.displayName,
            quantity: d.totalUnits
        }));
        await prescription.save();
        res.json(prescription);
    } catch (e) {
        console.error('prescriptions/issue error', e)
        res.status(500).json({ error: 'Server error' })
    }
});

// Email a prescription to the patient using optional custom template
// @route   POST /api/prescriptions/:id/email
// @access  Private/Doctor
router.post('/:id/email', protect, doctor, async (req, res) => {
    const pres = await req.db(Prescription).findById(req.params.id).populate('patient').populate('doctor', 'name email')
    if (!pres) return res.status(404).json({ error: 'Prescription not found' })
    // Determine target email
    const to = (req.body && req.body.to) || pres.patient?.email
    if (!to) return res.status(400).json({ error: 'No patient email provided' })
    // If prescription contains medicines, create a PaymentRequest so patient can pay from email
    let payShortUrl = null
    try {
        if (Array.isArray(pres.medicines) && pres.medicines.length) {
            // compute required quantities (reuse parsing helpers from issue endpoint)
            const parseFrequencyPerDay = (f) => {
                if (!f) return 1;
                const lower = f.toLowerCase().trim();
                if (/^\d+(?:-\d+)+$/.test(lower)) {
                    return lower.split('-').reduce((sum, part) => sum + (parseInt(part, 10) || 0), 0);
                }
                if (/^\d+$/.test(lower)) return parseInt(lower, 10);
                if (['od', 'daily', 'once'].includes(lower)) return 1;
                if (['bd', 'twice'].includes(lower)) return 2;
                if (['tid', 'thrice'].includes(lower)) return 3;
                if (['qid', 'four'].includes(lower)) return 4;
                const everyMatch = lower.match(/every\s*(\d+)\s*h/);
                if (everyMatch) { const h = parseInt(everyMatch[1], 10); return h ? Math.round(24 / h) : 1; }
                const qhMatch = lower.match(/q(\d+)h/);
                if (qhMatch) { const h = parseInt(qhMatch[1], 10); return h ? Math.round(24 / h) : 1; }
                return 1;
            };
            const parseDurationDays = (d) => {
                if (!d) return 1;
                const lower = d.toLowerCase().trim();
                const weekMatch = lower.match(/(\d+)\s*week/);
                if (weekMatch) return parseInt(weekMatch[1], 10) * 7;
                const dayMatch = lower.match(/(\d+)\s*d(?:ay|ays)?/);
                if (dayMatch) return parseInt(dayMatch[1], 10);
                if (/^\d+$/.test(lower)) return parseInt(lower, 10);
                return 1;
            };
            const parseTabletsPerDose = (dosage) => {
                if (!dosage) return 1;
                const match = dosage.trim().match(/^(\d+)/);
                if (match) return parseInt(match[1], 10) || 1;
                return 1;
            };

            const normalized = []
            const today = new Date(); today.setHours(0, 0, 0, 0)
            const medicineDocs = await Promise.all(pres.medicines.map(async (it) => {
                if (it.medicine) return req.db(Medicine).findById(it.medicine).select('sellingPrice gstRate expiryDate quantity name');
                return null;
            }));

            for (let idx = 0; idx < pres.medicines.length; idx++) {
                const it = pres.medicines[idx]
                const medDoc = medicineDocs[idx]
                const freqPerDay = parseFrequencyPerDay(it.frequency)
                const durationDays = parseDurationDays(it.duration)
                const tabletsPerDose = parseTabletsPerDose(it.dosage)
                const totalUnits = Math.max(1, freqPerDay * durationDays * tabletsPerDose)
                if (medDoc) {
                    if (medDoc.expiryDate && medDoc.expiryDate < today) {
                        // skip expired items from billing
                        continue
                    }
                    normalized.push({ medicine: medDoc._id, description: medDoc.name, quantity: totalUnits, unitPrice: Number(medDoc.sellingPrice || 0), gstRate: Number(medDoc.gstRate || 0) })
                } else {
                    // fallback: use name, default price
                    normalized.push({ description: it.name, quantity: totalUnits, unitPrice: 100, gstRate: 0 })
                }
            }
            if (normalized.length) {
                // compute totals
                const calcTotals = (items) => {
                    let subtotal = 0, gstTotal = 0
                    for (const it of items) { const line = Number(it.unitPrice || 0) * Number(it.quantity || 0); const gst = line * (Number(it.gstRate || 0) / 100); subtotal += line; gstTotal += gst }
                    return { subtotal, gstTotal, total: subtotal + gstTotal }
                }
                const totals = calcTotals(normalized)
                const pr = req.db(PaymentRequest)._wrap({ patientName: pres.patientName || pres.patient?.firstName || 'Patient', items: normalized, subtotal: totals.subtotal, gstTotal: totals.gstTotal, total: totals.total, createdBy: req.userId, createdByRole: 'doctor', email: pres.patientEmail || undefined, phone: pres.patient?.phone || undefined, doctor: { id: pres.doctor, name: pres.doctor?.name }, prescription: pres._id })
                await pr.save()

                // create razorpay link (best-effort). Use test keys from env.
                if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
                    try {
                        const razor = new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET })
                        const amountPaise = Math.round(Number(pr.total) * 100)
                        const linkPayload = {
                            amount: amountPaise,
                            currency: 'INR',
                            accept_partial: false,
                            description: `Payment for prescription ${pres._id}`,
                            reference_id: String(pr._id),
                            customer: { name: pr.patientName, contact: pr.phone || undefined, email: pr.email || undefined },
                            notify: { sms: false, email: Boolean(pr.email && String(pr.email).includes('@')) },
                            reminder_enable: false
                        }
                        const link = await razor.paymentLink.create(linkPayload)
                        pr.razorpay = { linkId: link.id, shortUrl: link.short_url, status: link.status }
                        await pr.save()
                        payShortUrl = link.short_url
                    } catch (e) {
                        console.error('[prescriptions] failed to create razorpay link', e)
                    }
                }
                // attach paymentRequest id to prescription for client reference
                pres.paymentRequest = pr._id
                await pres.save()
            }
        }
    } catch (e) {
        console.error('[prescriptions] failed to create payment request', e)
    }

    // Optional template to render
    let html = ''
    const company = process.env.COMPANY_NAME || 'PharmaPlus HMS'
    const safe = (s) => (s || '')
    if (req.body?.templateId) {
        const tpl = await req.db(PrescriptionTemplate).findOne({ _id: req.body.templateId, createdBy: req.userId })
        if (!tpl) return res.status(404).json({ error: 'Template not found' })
        if (tpl.html) {
            // Very light placeholder replacements
            const meds = (pres.medicines || []).map(m => `${safe(m.name)} ${safe(m.dosage) || ''} ${safe(m.frequency) || ''} ${safe(m.duration) || ''}`).join('<br/>')
            const tests = (pres.tests || []).map(t => `${safe(t.name)} ${safe(t.notes) || ''}`).join('<br/>')
            html = tpl.html
                .replace(/{{\s*patientName\s*}}/g, safe(pres.patient?.firstName ? `${pres.patient.firstName}${pres.patient.lastName ? ' ' + pres.patient.lastName : ''}` : 'Patient'))
                .replace(/{{\s*doctorName\s*}}/g, safe(pres.doctor?.name))
                .replace(/{{\s*date\s*}}/g, new Date(pres.createdAt || Date.now()).toLocaleString())
                .replace(/{{\s*medicines\s*}}/g, meds)
                .replace(/{{\s*tests\s*}}/g, tests)
                .replace(/{{\s*notes\s*}}/g, safe(pres.notes))
        }
    }
    if (!html) {
        // Professional fallback HTML
        // If we generated a pay link, include it prominently
        const paySection = payShortUrl ? `<div style="margin-top:18px"><a href="${payShortUrl}" style="background:#0ea5a4;color:#fff;padding:10px 14px;border-radius:6px;text-decoration:none;">Pay for Medicines</a></div>` : ''
        const medsList = (pres.medicines || []).map(m => `<li style="margin-bottom:6px">${safe(m.name)} ${safe(m.dosage) || ''} <span style="color:#64748b">${safe(m.frequency) || ''}</span> <span style="color:#64748b">${safe(m.duration) || ''}</span></li>`).join('')
        const testsList = (pres.tests || []).map(t => `<li style="margin-bottom:6px">${safe(t.name)} ${safe(t.notes) || ''}</li>`).join('')
        const logo = process.env.COMPANY_LOGO_URL ? `<img src="${process.env.COMPANY_LOGO_URL}" alt="${company} logo" style="max-height:60px;margin-bottom:8px"/>` : `<div style="font-weight:700;font-size:20px;color:#0f172a">HOSPITECHVERSE</div>`
        html = `<!DOCTYPE html><html><head><meta charset="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <style>body{background:#f6f9fc;font-family:Inter,Segoe UI,Arial,sans-serif;margin:0;padding:24px;color:#0f172a} .container{max-width:800px;margin:0 auto;background:#fff;border-radius:10px;padding:24px;box-shadow:0 6px 18px rgba(15,23,42,0.06)} .header{display:flex;align-items:center;justify-content:space-between} h1{font-size:18px;margin:8px 0 0} .meta{color:#475569;font-size:13px;margin-top:4px} .section{margin-top:18px} .section h2{font-size:15px;margin:0 0 8px} ul{margin:0 0 8px 18px;color:#0f172a}</style></head><body>
        <div class="container">
        <div class="header">${logo}<div style="text-align:right"><div style="font-size:14px;font-weight:600">${company}</div><div class="meta">Prescription</div></div></div>
        <div style="margin-top:12px" class="meta">Date: ${new Date(pres.createdAt || Date.now()).toLocaleString()}</div>
        <div style="margin-top:6px" class="meta">Doctor: Dr. ${safe(pres.doctor?.name)}</div>
        <div style="margin-top:6px" class="meta">Patient: ${safe(pres.patient?.firstName ? `${pres.patient.firstName}${pres.patient.lastName ? ' ' + pres.patient.lastName : ''}` : (pres.patientName || 'Patient'))}${pres.patientEmail ? ` • ${safe(pres.patientEmail)}` : ''}</div>
        <div class="section"><h2>Medicines</h2><ul>${medsList || '<li>—</li>'}</ul></div>
        <div class="section"><h2>Tests</h2><ul>${testsList || '<li>—</li>'}</ul></div>
        ${pres.notes ? `<div class="section"><h2>Notes</h2><div style="color:#334155">${safe(pres.notes)}</div></div>` : ''}
        ${pres.followUp ? `<div class="section"><h2>Follow Up</h2><div style="color:#334155">${new Date(pres.followUp).toLocaleDateString()}</div></div>` : ''}
        <div style="margin-top:22px;color:#94a3b8;font-size:12px">This prescription was generated by ${company}. For queries, contact your provider.</div>
        </div>${paySection}</body></html>`
    }
    // If the client requested the PDF as an attachment, prefer a short email body
    // and rely on the attached PDF for full prescription details.
    if (req.body?.attachPdf) {
        const doctorName = pres.doctor?.name ? `Dr. ${safe(pres.doctor.name)}` : 'Your doctor'
        const patientDisplay = pres.patient?.firstName ? `${pres.patient.firstName}${pres.patient.lastName ? ' ' + pres.patient.lastName : ''}` : (pres.patientName || 'Patient')
        html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div style="font-family:Inter,Segoe UI,Arial,sans-serif;color:#0f172a;padding:18px"><div style="font-weight:700;font-size:18px;margin-bottom:8px">${company} - Prescription</div><div style="margin-bottom:12px">Hello ${safe(patientDisplay)},</div><div style="margin-bottom:12px">Please find your prescription attached as a PDF. If you have any questions, reply to this email or contact your provider.</div><div style="margin-top:18px">Prescribed by: <strong>${doctorName}</strong></div><div style="margin-top:18px;color:#94a3b8;font-size:12px">This prescription was generated by ${company}.</div></div></body></html>`
    }
    try {
        // allow attaching generated PDF (if present and attachPdf flag set)
        const attachPdf = !!req.body?.attachPdf

        // If client requested an attachment and PDF is missing (or file doesn't exist), regenerate here
        if (attachPdf) {
            let needRegen = false
            if (!pres.pdfPath) needRegen = true
            else {
                try {
                    const absTest = path.join(process.cwd(), pres.pdfPath.replace(/^\//, ''))
                    if (!fs.existsSync(absTest)) needRegen = true
                } catch (e) { needRegen = true }
            }
            if (needRegen) {
                try {
                    const doc = new PDFDocument({ size: 'A4', margin: 40 })
                    const chunks = []
                    doc.on('data', d => chunks.push(d))
                    const logoUrl = process.env.COMPANY_LOGO_URL || ''
                    if (logoUrl) {
                        try {
                            const resp = await fetch(logoUrl)
                            if (resp.ok) {
                                const buf = await resp.arrayBuffer()
                                doc.image(Buffer.from(buf), { fit: [120, 60] })
                            }
                        } catch (e) { /* ignore */ }
                    } else {
                        doc.fontSize(20).text('HOSPITECHVERSE', { align: 'left' })
                    }
                    doc.moveDown()
                    doc.fontSize(12).text(`Patient: ${pres.patientName || '—'}`)
                    if (pres.patientEmail) doc.text(`Email: ${pres.patientEmail}`)
                    doc.text(`Date: ${new Date(pres.createdAt).toLocaleString()}`)
                    doc.moveDown()
                    doc.fontSize(14).text('Medicines', { underline: true })
                    doc.moveDown(0.5)
                        (pres.medicines || []).forEach((m, i) => {
                            doc.fontSize(12).text(`${i + 1}. ${m.name} — ${m.dosage || ''} — ${m.frequency || ''} — ${m.duration || ''}`)
                            doc.moveDown(0.2)
                        })
                    if (pres.notes) {
                        doc.moveDown()
                        doc.fontSize(13).text('Notes', { underline: true })
                        doc.moveDown(0.3)
                        doc.fontSize(11).text(pres.notes)
                    }
                    try {
                        const docUser = await User.findById(pres.doctor).select('name signatureUrl')
                        if (docUser) {
                            doc.moveDown(1.2)
                            if (docUser.signatureUrl) {
                                try {
                                    const resp = await fetch(docUser.signatureUrl)
                                    if (resp.ok) {
                                        const buf = await resp.arrayBuffer()
                                        doc.image(Buffer.from(buf), { fit: [160, 80] })
                                        doc.moveDown(0.5)
                                    }
                                } catch (e) { /* ignore signature fetch errors */ }
                            }
                            doc.moveDown(0.5)
                            doc.fontSize(11).text(`Prescribed by: Dr. ${docUser.name}`, { continued: false })
                        }
                    } catch (e) { /* ignore */ }
                    doc.end()
                    await new Promise((resolve, reject) => {
                        doc.on('end', resolve)
                        doc.on('error', reject)
                    })
                    const pdfBuffer = Buffer.concat(chunks)
                    let pdfPathRel = ''
                    try {
                        const result = await uploadToCloudinary(pdfBuffer, 'prescriptions', 'raw')
                        pdfPathRel = result.secure_url
                    } catch (e) { console.error('Cloudinary upload err', e) }
                    pres.pdfPath = pdfPathRel
                    await pres.save()
                } catch (e) {
                    console.error('Failed to regenerate PDF before emailing', e)
                }
            }
        }

        const attachments = []
        if (attachPdf && pres.pdfPath) {
            try {
                if (pres.pdfPath.startsWith('http')) {
                    attachments.push({ filename: `prescription-${pres._id}.pdf`, path: pres.pdfPath })
                } else {
                    const abs = path.join(process.cwd(), pres.pdfPath.replace(/^\//, ''))
                    if (fs.existsSync(abs)) attachments.push({ filename: path.basename(abs), path: abs })
                    else console.warn('[prescriptions] pdf file missing at', abs)
                }
            } catch (e) { console.error('pdf attach check failed', e) }
        }

        console.log('[prescriptions] emailing', { to, attachmentsCount: attachments.length, attachments: attachments.map(a => a.path) })
        const result = await sendEmail(to, `${company}: Prescription`, html, attachments.length ? { attachments } : undefined)
        console.log('[prescriptions] sendEmail result:', result)
        if (!result || !result.ok) {
            console.error('[prescriptions] email failed or not sent', result)
            return res.status(500).json({ error: 'Failed to send email', details: result })
        }

        // Mark as sent and link to patient record if not already
        try {
            pres.sent = true
            pres.sentAt = new Date()
            pres.sentBy = req.userId
            // If prescription not linked to a patient document, try to match by email and link
            if (!pres.patient && pres.patientEmail) {
                const pat = await req.db(Patient).findOne({ email: pres.patientEmail })
                if (pat) {
                    pres.patient = pat._id
                    pat.prescriptions = pat.prescriptions || []
                    if (!pat.prescriptions.find(id => String(id) === String(pres._id))) pat.prescriptions.push(pres._id)
                    await pat.save()
                }
            }
            await pres.save()
        } catch (e) { console.error('Failed to mark prescription as sent', e) }
    } catch (e) {
        console.error('Email send failed', e)
        return res.status(500).json({ error: 'Failed to send email' })
    }
    res.json({ ok: true })
})

// @desc    Update prescription content (doctor edits draft)
// @route   PUT /api/prescriptions/:id
// @access  Private/Doctor
router.put('/:id', protect, doctor, async (req, res) => {
    try {
        const pres = await req.db(Prescription).findById(req.params.id)
        if (!pres) return res.status(404).json({ error: 'Prescription not found' })
        if (String(pres.doctor) !== String(req.userId)) return res.status(403).json({ error: 'Forbidden' })
        const { medicines, tests, notes, followUp, patientName, patientEmail } = req.body
        if (medicines) {
            try {
                // Sanitize medicines array: remove empty entries (no name) to avoid validation errors
                const clean = Array.isArray(medicines) ? medicines.filter(m => m && (m.name || '').toString().trim().length > 0) : []
                pres.medicines = clean.map(m => ({
                    name: (m.name || '').toString().trim(),
                    dosage: m.dosage || '',
                    frequency: m.frequency || '',
                    duration: m.duration || ''
                }))
            } catch (e) {
                console.warn('Failed to sanitize medicines payload', e)
                pres.medicines = medicines
            }
        }
        if (tests) pres.tests = tests
        if (typeof notes !== 'undefined') pres.notes = notes
        if (typeof followUp !== 'undefined') pres.followUp = followUp
        if (typeof patientName !== 'undefined') pres.patientName = patientName
        if (typeof patientEmail !== 'undefined') pres.patientEmail = patientEmail
        // Save updates
        const updated = await pres.save()

        // regenerate PDF
        try {
            const doc = new PDFDocument({ size: 'A4', margin: 40 })
            const chunks = []
            doc.on('data', d => chunks.push(d))
            const logoUrl = process.env.COMPANY_LOGO_URL || ''
            if (logoUrl) {
                try {
                    const resp = await fetch(logoUrl)
                    if (resp.ok) {
                        const buf = await resp.arrayBuffer()
                        doc.image(Buffer.from(buf), { fit: [120, 60] })
                    }
                } catch (e) { /* ignore */ }
            } else {
                doc.fontSize(20).text('HOSPITECHVERSE', { align: 'left' })
            }
            doc.moveDown()
            doc.fontSize(12).text(`Patient: ${updated.patientName || '—'}`)
            if (updated.patientEmail) doc.text(`Email: ${updated.patientEmail}`)
            doc.text(`Date: ${new Date(updated.createdAt).toLocaleString()}`)
            doc.moveDown()
            doc.fontSize(14).text('Medicines', { underline: true })
            doc.moveDown(0.5)
            updated.medicines.forEach((m, i) => {
                doc.fontSize(12).text(`${i + 1}. ${m.name} — ${m.dosage || ''} — ${m.frequency || ''} — ${m.duration || ''}`)
                doc.moveDown(0.2)
            })
            if (updated.notes) {
                doc.moveDown()
                doc.fontSize(13).text('Notes', { underline: true })
                doc.moveDown(0.3)
                doc.fontSize(11).text(updated.notes)
            }
            // Add prescribing doctor's signature/name at the end
            try {
                const docUser = await User.findById(updated.doctor).select('name signatureUrl email')
                if (docUser) {
                    doc.moveDown(1.2)
                    // attempt to include signature image if available
                    if (docUser.signatureUrl) {
                        try {
                            const resp = await fetch(docUser.signatureUrl)
                            if (resp.ok) {
                                const buf = await resp.arrayBuffer()
                                doc.image(Buffer.from(buf), { fit: [160, 80] })
                                doc.moveDown(0.5)
                            }
                        } catch (e) { /* ignore signature fetch errors */ }
                    }
                    doc.moveDown(0.5)
                    doc.fontSize(11).text(`Prescribed by: Dr. ${docUser.name}`, { continued: false })
                }
            } catch (e) { /* ignore doctor footer errors */ }
            doc.end()
            await new Promise((resolve, reject) => {
                doc.on('end', resolve)
                doc.on('error', reject)
            })
            const pdfBuffer = Buffer.concat(chunks)
            let pdfPathRel = ''
            try {
                const result = await uploadToCloudinary(pdfBuffer, 'prescriptions', 'raw')
                pdfPathRel = result.secure_url
            } catch (e) { console.error('Cloudinary upload err', e) }
            updated.pdfPath = pdfPathRel
            await updated.save()
        } catch (e) {
            console.error('Failed to regenerate PDF', e)
        }

        res.json(updated)
    } catch (e) {
        console.error('Failed to update prescription', e)
        res.status(500).json({ error: 'Server error' })
    }
})

// Auto-generate a prescription draft using appointment context and external medicine API
// @route POST /api/prescriptions/autogen
// @access Private/Doctor
router.post('/autogen', protect, doctor, async (req, res) => {
    try {
        const { appointmentId, patientId, patientName, patientEmail, apiKey } = req.body
        let diseaseText = ''
        let appt = null
        if (appointmentId && appointmentId !== 'null' && appointmentId !== 'undefined') {
            try {
                const AppointmentModel = (await import('../models/Appointment.js')).default
                appt = await AppointmentModel.findById(appointmentId)
                if (!appt) {
                    console.warn(`[autogen] Appointment ${appointmentId} not found, proceeding without context`)
                } else if (String(appt.doctor) !== String(req.userId)) {
                    console.warn(`[autogen] Doctor ${req.userId} does not own appointment ${appt._id}, proceeding without context`)
                    appt = null
                } else {
                    diseaseText = appt.diseaseText || ''
                }
            } catch (err) {
                console.error(`[autogen] Failed to load appointment ${appointmentId}`, err)
            }
        }
        // basic extraction: keywords mapping
        const kw = (diseaseText || '').toLowerCase()
        const mapping = {
            fever: 'Paracetamol',
            cough: 'Dextromethorphan',
            cold: 'Cetirizine',
            headache: 'Ibuprofen',
            pain: 'Diclofenac',
            infection: 'Amoxicillin',
            acidity: 'Pantoprazole',
            vomiting: 'Ondansetron',
            diarrhea: 'Loperamide',
            allergy: 'Levocetirizine'
        }
        const candidates = []
        Object.keys(mapping).forEach(k => { if (kw.includes(k)) candidates.push(mapping[k]) })
        // fallback: try 'paracetamol'
        if (candidates.length === 0) candidates.push('paracetamol')

        // Query external medicine API (Upchar) if apiKey provided to enrich results
        const enrichPromises = candidates.map(async (name) => {
            let m = { name, dosage: '1 tab', frequency: 'once a day', duration: '3 days' }
            if (apiKey) {
                try {
                    const q = new URLSearchParams({ api_key: apiKey, name, page: '1' })
                    const url = `https://beta.myupchar.com/api/medicine/search?${q.toString()}`
                    const r = await fetch(url)
                    if (r.ok) {
                        const data = await r.json()
                        if (Array.isArray(data) && data.length > 0) {
                            const first = data[0]
                            m.manufacturer = first.manufacturer || first.company || ''
                            m.category = first.category_id || ''
                            // prefer official name
                            if (first.name) m.name = first.name
                        }
                    }
                } catch (e) { console.error('Upchar search failed', e) }
            }
            return m
        })
        const meds = await Promise.all(enrichPromises)

        // If appointment links to a registered patient, try to resolve patient record
        let resolvedPatientId = patientId || undefined
        if (!resolvedPatientId && appt) {
            if (appt.patientUser) {
                const user = await User.findById(appt.patientUser).select('email')
                if (user && user.email) {
                    const pat = await req.db(Patient).findOne({ email: user.email })
                    if (pat) resolvedPatientId = pat._id
                }
            }
            if (!resolvedPatientId && appt.patientEmail) {
                const pat = await req.db(Patient).findOne({ email: appt.patientEmail })
                if (pat) resolvedPatientId = pat._id
            }
        }

        const pres = req.db(Prescription)._wrap({
            patient: resolvedPatientId || undefined,
            patientName: patientName || (appt && appt.patientName) || undefined,
            patientEmail: patientEmail || (appt && appt.patientEmail) || undefined,
            doctor: req.userId,
            medicines: meds.map(m => ({ name: m.name, dosage: m.dosage, frequency: m.frequency, duration: m.duration })),
            notes: `Auto-generated draft from appointment ${appointmentId || ''}`,
            approvalStatus: 'pending'
        })
        const created = await pres.save()

        // Generate PDF into Cloudinary using pdfkit
        try {
            const doc = new PDFDocument({ size: 'A4', margin: 40 })
            const chunks = []
            doc.on('data', d => chunks.push(d))
            // Header
            const logoUrl = process.env.COMPANY_LOGO_URL || ''
            if (logoUrl) {
                try {
                    const resp = await fetch(logoUrl)
                    if (resp.ok) {
                        const buf = await resp.arrayBuffer()
                        doc.image(Buffer.from(buf), { fit: [120, 60] })
                    }
                } catch (e) { /* ignore */ }
            } else {
                doc.fontSize(20).text('HOSPITECHVERSE', { align: 'left' })
            }
            doc.moveDown()
            doc.fontSize(12).text(`Patient: ${created.patientName || '—'}`)
            if (created.patientEmail) doc.text(`Email: ${created.patientEmail}`)
            doc.text(`Date: ${new Date(created.createdAt).toLocaleString()}`)
            doc.moveDown()
            doc.fontSize(14).text('Medicines', { underline: true })
            doc.moveDown(0.5)
            created.medicines.forEach((m, i) => {
                doc.fontSize(12).text(`${i + 1}. ${m.name} — ${m.dosage || ''} — ${m.frequency || ''} — ${m.duration || ''}`)
                doc.moveDown(0.2)
            })
            if (created.notes) {
                doc.moveDown()
                doc.fontSize(13).text('Notes', { underline: true })
                doc.moveDown(0.3)
                doc.fontSize(11).text(created.notes)
            }
            // Add prescribing doctor's signature/name at the end
            try {
                const docUser = await User.findById(created.doctor).select('name signatureUrl email')
                if (docUser) {
                    doc.moveDown(1.2)
                    if (docUser.signatureUrl) {
                        try {
                            const resp = await fetch(docUser.signatureUrl)
                            if (resp.ok) {
                                const buf = await resp.arrayBuffer()
                                doc.image(Buffer.from(buf), { fit: [160, 80] })
                                doc.moveDown(0.5)
                            }
                        } catch (e) { /* ignore */ }
                    }
                    doc.moveDown(0.5)
                    doc.fontSize(11).text(`Prescribed by: Dr. ${docUser.name}`, { continued: false })
                }
            } catch (e) { /* ignore */ }
            doc.end()
            await new Promise((resolve, reject) => {
                doc.on('end', resolve)
                doc.on('error', reject)
            })
            const pdfBuffer = Buffer.concat(chunks)
            let pdfPathRel = ''
            try {
                const result = await uploadToCloudinary(pdfBuffer, 'prescriptions', 'raw')
                pdfPathRel = result.secure_url
            } catch (e) { console.error('Cloudinary upload err', e) }
            created.pdfPath = pdfPathRel
            await created.save()
        } catch (e) {
            console.error('Failed to generate PDF', e)
        }

        res.status(201).json({ prescription: created, pdfUrl: created.pdfPath })
    } catch (e) {
        console.error('autogen error', e)
        res.status(500).json({ error: e.message || 'Failed to autogenerate prescription' })
    }
})

// Create a payment request from a prescription (patient can click Buy)
router.post('/:id/create-payment', protect, async (req, res) => {
    try {
        // Populate patient and doctor so we can include doctor's name on the payment request/invoice
        const pres = await req.db(Prescription).findById(req.params.id).populate('patient').populate('doctor', 'name email phone')
        if (!pres) return res.status(404).json({ error: 'Prescription not found' })
        if (!Array.isArray(pres.medicines) || pres.medicines.length === 0) return res.status(400).json({ error: 'No medicines to bill' })

        const parseFrequencyPerDay = (f) => {
            if (!f) return 1;
            const lower = f.toLowerCase().trim();
            if (/^\d+(?:-\d+)+$/.test(lower)) return lower.split('-').reduce((s, p) => s + (parseInt(p, 10) || 0), 0);
            if (/^\d+$/.test(lower)) return parseInt(lower, 10);
            if (['od', 'daily', 'once'].includes(lower)) return 1;
            if (['bd', 'twice'].includes(lower)) return 2;
            if (['tid', 'thrice'].includes(lower)) return 3;
            if (['qid', 'four'].includes(lower)) return 4;
            const everyMatch = lower.match(/every\s*(\d+)\s*h/); if (everyMatch) { const h = parseInt(everyMatch[1], 10); return h ? Math.round(24 / h) : 1 }
            const qhMatch = lower.match(/q(\d+)h/); if (qhMatch) { const h = parseInt(qhMatch[1], 10); return h ? Math.round(24 / h) : 1 }
            return 1;
        }
        const parseDurationDays = (d) => {
            if (!d) return 1; const lower = d.toLowerCase().trim(); const weekMatch = lower.match(/(\d+)\s*week/); if (weekMatch) return parseInt(weekMatch[1], 10) * 7; const dayMatch = lower.match(/(\d+)\s*d(?:ay|ays)?/); if (dayMatch) return parseInt(dayMatch[1], 10); if (/^\d+$/.test(lower)) return parseInt(lower, 10); return 1
        }
        const parseTabletsPerDose = (dosage) => { if (!dosage) return 1; const match = dosage.trim().match(/^(\d+)/); if (match) return parseInt(match[1], 10) || 1; return 1 }

        const normalized = []
        const today = new Date(); today.setHours(0, 0, 0, 0)
        const medicineDocs = await Promise.all(pres.medicines.map(async (it) => {
            if (it.medicine) return req.db(Medicine).findById(it.medicine).select('sellingPrice gstRate expiryDate quantity name');
            return null;
        }));

        for (let idx = 0; idx < pres.medicines.length; idx++) {
            const it = pres.medicines[idx]
            const medDoc = medicineDocs[idx]
            const freqPerDay = parseFrequencyPerDay(it.frequency)
            const durationDays = parseDurationDays(it.duration)
            const tabletsPerDose = parseTabletsPerDose(it.dosage)
            const totalUnits = Math.max(1, freqPerDay * durationDays * tabletsPerDose)
            if (medDoc) {
                if (medDoc.expiryDate && medDoc.expiryDate < today) continue
                normalized.push({ medicine: medDoc._id, description: medDoc.name, quantity: totalUnits, unitPrice: Number(medDoc.sellingPrice || 0), gstRate: Number(medDoc.gstRate || 0) })
            } else {
                normalized.push({ description: it.name, quantity: totalUnits, unitPrice: 100, gstRate: 0 })
            }
        }
        if (!normalized.length) return res.status(400).json({ error: 'No billable items (all expired or missing)' })
        const calcTotals = (items) => { let subtotal = 0, gstTotal = 0; for (const it of items) { const line = Number(it.unitPrice || 0) * Number(it.quantity || 0); const gst = line * (Number(it.gstRate || 0) / 100); subtotal += line; gstTotal += gst } return { subtotal, gstTotal, total: subtotal + gstTotal } }
        const totals = calcTotals(normalized)
        const doctorInfo = pres.doctor ? { id: pres.doctor._id || pres.doctor, name: pres.doctor.name || undefined } : undefined
        const pr = req.db(PaymentRequest)._wrap({ patientName: pres.patientName || pres.patient?.firstName || 'Patient', items: normalized, subtotal: totals.subtotal, gstTotal: totals.gstTotal, total: totals.total, createdBy: req.userId, createdByRole: req.userRole || 'patient', email: pres.patientEmail || pres.patient?.email || undefined, phone: pres.patient?.phone || pres.doctor?.phone || undefined, doctor: doctorInfo, prescription: pres._id })
        await pr.save()

        // Create a draft invoice (unpaid) for this payment request so patient can view invoice before paying
        try {
            const invDoc = req.db(Invoice)._wrap({
                patientName: pr.patientName,
                items: pr.items,
                subtotal: pr.subtotal,
                gstTotal: pr.gstTotal,
                total: pr.total,
                patient: pres.patient || undefined,
                createdBy: req.userId,
                createdByRole: 'patient',
                doctor: pr.doctor?.id,
                doctorName: pr.doctor?.name,
                paid: false
            })
            await invDoc.save()
            pr.invoice = invDoc._id
            await pr.save()
        } catch (e) {
            console.error('[prescriptions] failed to create draft invoice', e)
        }

        let shortUrl = null, linkId = null
        if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
            try {
                const razor = new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET })
                const amountPaise = Math.round(Number(pr.total) * 100)
                const callbackUrl = process.env.CORS_ORIGIN ? `${process.env.CORS_ORIGIN}/prescriptions?payment=success` : undefined
                const linkPayload = { amount: amountPaise, currency: 'INR', accept_partial: false, description: `Payment for prescription ${pres._id}`, reference_id: String(pr._id), customer: { name: pr.patientName, contact: pr.phone || undefined, email: pr.email || undefined }, notify: { sms: false, email: Boolean(pr.email && String(pr.email).includes('@')) }, reminder_enable: false, callback_url: callbackUrl, callback_method: 'get' }
                console.log('[prescriptions] creating razorpay link with payload:', JSON.stringify(linkPayload))
                let link
                try {
                    link = await razor.paymentLink.create(linkPayload)
                } catch (firstErr) {
                    console.warn('[prescriptions] initial razorpay link failed, retrying without phone', firstErr)
                    // Retry without phone number if that was the cause (e.g. recurring digits or invalid format)
                    if (linkPayload.customer.contact) {
                        delete linkPayload.customer.contact
                        link = await razor.paymentLink.create(linkPayload)
                    } else {
                        throw firstErr
                    }
                }
                console.log('[prescriptions] razorpay link created:', link.short_url)
                pr.razorpay = { linkId: link.id, shortUrl: link.short_url, status: link.status }
                await pr.save()
                shortUrl = link.short_url
                linkId = link.id
            } catch (e) {
                console.error('[prescriptions] create-payment razorpay link failed', e.error || e)
                // If razorpay fails, we can't open the payment page properly if that was the intent.
                // But we have the invoice fallback. 
                // Let's pass the error to frontend? No, frontend falls back.
                // But user says "not getting opened". Maybe fallback is not what they want.
            }
        }
        pres.paymentRequest = pr._id
        await pres.save()
        res.json({ ok: true, shortUrl, linkId, paymentRequestId: pr._id, invoiceId: pr.invoice || null, keyId: process.env.RAZORPAY_KEY_ID || null })
    } catch (e) {
        console.error('[prescriptions] create-payment failed', e)
        res.status(500).json({ error: 'Server error' })
    }
})
export default router;
