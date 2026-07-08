import express from 'express';
import Patient from '../models/Patient.js';
import Bed from '../models/Bed.js';
import Ward from '../models/Ward.js';
import Invoice from '../models/Invoice.js';
import User from '../models/User.js';
import Prescription from '../models/Prescription.js';
import Appointment from '../models/Appointment.js';
import PrescriptionTemplate from '../models/PrescriptionTemplate.js';
import { protect, doctor } from '../utils/auth.js';
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { loadTenant, enforcePlanLimit } from '../utils/saas.js';
import { allowRolesWithSubadminFeature } from '../utils/permissions.js';
import { sendEmail } from '../utils/notify.js';
import { bedDischargeTemplate } from '../utils/emailTemplates.js';
import { uploadPatients, uploadToCloudinary } from '../config/cloudinary.js';
import { buildPublicFrontendUrl } from '../utils/publicUrl.js';
import { triggerBackgroundUpdate } from '../services/cacheService.js';
import { getCache, setCache } from '../utils/redis.js';

const router = express.Router();
const upload = uploadPatients;
// Avatar and reports go to same cloudinary folder for patients
const uploadAvatar = uploadPatients;
const uploadMany = uploadPatients;

// @desc    Get all patients (tenant-scoped when available)
// @route   GET /api/patients
// @access  Private/Doctor/Admin/Subadmin
router.get('/', protect, loadTenant, allowRolesWithSubadminFeature(['doctor', 'admin', 'subadmin'], 'view_patients'), async (req, res) => {
    try {
        const tenantId = req.tenant?._id || req.user?.tenantId
        const limit = Number(req.query.limit) || 100
        const page = Number(req.query.page) || 1
        const all = req.query.limit === 'all'

        const cacheKey = `hms:patients:list:${tenantId}:${page}:${limit}:${all}`
        const cached = await getCache(cacheKey)
        if (cached) {
            return res.json(cached)
        }

        const q = {}
        // Strict tenant isolation for admins/subadmins
        if (req.tenant) q.tenantId = req.tenant._id
        else if (req.user && req.user.tenantId) q.tenantId = req.user.tenantId

        // Role-aware visibility: relaxed for visibility fix
        /*
        const role = req.user?.role
        if (role === 'admin' || role === 'subadmin') {
             
        } else if (role === 'doctor') {
            try {
                const docUser = await User.findById(req.userId).select('createdBy')
                if (docUser && docUser.createdBy) {
                    q.createdBy = docUser.createdBy
                }
            } catch (e) { }
        }
        */
        const skip = (page - 1) * limit

        const query = req.db(Patient).find(q).select('firstName lastName dob phone email createdBy gender bloodGroup address allergies emergencyContact')
        if (req.query.limit !== 'all') {
            query.limit(limit).skip(skip)
        }
        const patients = await query;
        await setCache(cacheKey, patients, 30).catch(() => {})
        res.json(patients);
    } catch (e) {
        console.error(e)
        // Handle duplicate key (email + tenant) index violation
        if (e && e.code === 11000) {
            return res.status(400).json({ error: 'Patient with this email already exists' })
        }
        res.status(500).json({ error: 'Server error' })
    }
});

// @desc    Get patient by ID
// @route   GET /api/patients/:id
// @access  Private/Doctor
// NOTE: routes for the authenticated user ('/me') must be defined before the param route '/:id'
// to avoid Express treating 'me' as an :id and accidentally applying doctor-only middleware.

// Patient self view (maps user email to patient record)
router.get('/me', protect, async (req, res) => {
    const user = await User.findById(req.userId).select('email name role tenantId');
    if (!user) return res.status(404).json({ error: 'User not found' });
    // Ensure email comparison is case-insensitive
    const emailLower = (user.email || '').toLowerCase();
    let patient = await req.db(Patient).findOne({ email: emailLower })
        .populate('prescriptions')
        .populate({ path: 'inpatient.bed', select: 'bedNumber ward isOccupied' })
        .populate({ path: 'inpatient.ward', select: 'name type floor pricePerDay' });

    if (!patient) {
        // Lazy create patient profile if missing (e.g. self-registered users)
        try {
            const nameParts = (user.name || '').trim().split(/\s+/);
            const firstName = nameParts[0] || 'Patient';
            const lastName = nameParts.slice(1).join(' ') || '';
            patient = await req.db(Patient).create({
                firstName,
                lastName,
                email: emailLower,
                user: user._id,
                tenantId: user.tenantId
            });
            // Re-fetch (though fields like prescriptions will be empty) or just return
            // Re-fetch (though fields like prescriptions will be empty) or just return
        } catch (e) {
            console.warn('Failed to auto-create patient profile', e);
            return res.status(404).json({ error: 'Patient record not found and creation failed' });
        }
    }
    res.json(patient);
});

// Explicit inpatient allocation view for patient dashboard
// @route GET /api/patients/me/inpatient
router.get('/me/inpatient', protect, async (req, res) => {
    const user = await User.findById(req.userId).select('email');
    if (!user) return res.status(404).json({ error: 'User not found' });
    const patient = await req.db(Patient).findOne({ email: user.email })
        .populate({ path: 'inpatient.bed', select: 'bedNumber ward isOccupied' })
        .populate({ path: 'inpatient.ward', select: 'name type floor pricePerDay' });
    if (!patient || !patient.inpatient.isAdmitted) return res.json({ admitted: false });
    const { inpatient } = patient;
    res.json({
        admitted: inpatient.isAdmitted,
        admittedAt: inpatient.admittedAt,
        bed: inpatient.bed ? { id: inpatient.bed._id, bedNumber: inpatient.bed.bedNumber } : null,
        ward: inpatient.ward ? { id: inpatient.ward._id, name: inpatient.ward.name, type: inpatient.ward.type, floor: inpatient.ward.floor, pricePerDay: inpatient.ward.pricePerDay } : null
    });
});

// Patient list own reports
router.get('/me/reports', protect, async (req, res) => {
    console.log('[DEBUG] GET /api/patients/me/reports hit. User:', req.userId);
    const user = await User.findById(req.userId).select('email');
    if (!user) {
        console.log('[DEBUG] User not found for ID:', req.userId);
        return res.status(404).json({ error: 'User not found' });
    }
    // Case insensitive match for patient email
    const patient = await req.db(Patient).findOne({ email: { $regex: new RegExp(`^${user.email}$`, 'i') } }).select('digitalReports');
    if (!patient) return res.json([]);
    res.json(patient.digitalReports);
});

// Patient upload own report
router.post('/me/reports', protect, upload.single('report'), async (req, res) => {
    console.log('[DEBUG] POST /api/patients/me/reports hit. User:', req.userId);
    const user = await User.findById(req.userId).select('email name tenantId');
    if (!user) {
        console.log('[DEBUG] User not found for ID:', req.userId);
        return res.status(404).json({ error: 'User not found' });
    }
    const emailLower = (user.email || '').toLowerCase();
    let patient = await req.db(Patient).findOne({ email: emailLower });

    // Auto-create if missing (same as GET /me)
    if (!patient) {
        console.log('[DEBUG] Patient record missing for upload, auto-creating...');
        try {
            const nameParts = (user.name || '').trim().split(/\s+/);
            const firstName = nameParts[0] || 'Patient';
            const lastName = nameParts.slice(1).join(' ') || '';
            patient = await req.db(Patient).create({
                firstName,
                lastName,
                email: emailLower,
                user: user._id,
                tenantId: user.tenantId
            });
        } catch (e) {
            console.error('[DEBUG] Failed to auto-create patient:', e);
            return res.status(500).json({ error: 'Failed to create patient profile' });
        }
    }

    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const report = {
        _id: crypto.randomUUID(),
        title: req.body.title || req.file.originalname,
        url: req.file.path, // Cloudinary secure_url
        mimeType: req.file.mimetype,
        size: req.file.size,
        originalName: req.file.originalname,
        uploadedAt: new Date()
    };
    patient.digitalReports.push(report);
    await patient.save();
    res.status(201).json(report);
});

// Patient upload multiple reports (multipart/form-data with field name 'reports')
router.post('/me/reports/multi', protect, uploadMany.array('reports', 50), async (req, res) => {
    const user = await User.findById(req.userId).select('email');
    if (!user) return res.status(404).json({ error: 'User not found' });
    const patient = await req.db(Patient).findOne({ email: { $regex: new RegExp(`^${user.email}$`, 'i') } });
    if (!patient) return res.status(404).json({ error: 'Patient record not found' });
    if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'No files uploaded' });
    const uploadPromises = req.files.map(async (f) => {
        try {
            const cldObj = await uploadToCloudinary(f.buffer, 'patients', 'auto')
            return {
                _id: crypto.randomUUID(),
                title: f.originalname,
                url: cldObj.secure_url,
                mimeType: f.mimetype,
                size: f.size,
                originalName: f.originalname,
                uploadedAt: new Date()
            }
        } catch (e) {
            console.error('Cloudinary report upload failed:', e.message)
            return null
        }
    })
    const uploadedReports = await Promise.all(uploadPromises)
    const created = uploadedReports.filter(Boolean)
    patient.digitalReports.push(...created)
    await patient.save()
    res.status(201).json(created);
});

// Patient update own profile
router.put('/me', protect, async (req, res) => {
    const user = await User.findById(req.userId).select('email');
    if (!user) return res.status(404).json({ error: 'User not found' });
    const patient = await req.db(Patient).findOne({ email: { $regex: new RegExp(`^${user.email}$`, 'i') } });
    if (!patient) return res.status(404).json({ error: 'Patient record not found' });
    // Allow patient to update limited safe fields
    const up = req.body || {};
    patient.firstName = up.firstName || patient.firstName;
    patient.lastName = up.lastName || patient.lastName;
    patient.phone = up.phone || patient.phone;
    patient.address = up.address || patient.address;
    patient.emergencyContact = up.emergencyContact || patient.emergencyContact;
    patient.allergies = up.allergies || patient.allergies;
    // Allow patients to add or update their own medicalHistory entries
    if (Array.isArray(up.medicalHistory)) {
        patient.medicalHistory = up.medicalHistory;
    }
    // Allow email change (and update linked User record) if provided
    if (up.email && up.email !== user.email) {
        // Ensure no other user already using the email
        const existing = await User.findOne({ email: up.email.toLowerCase(), tenantId: user.tenantId });
        if (existing) return res.status(400).json({ error: 'Email already in use in this hospital' });
        user.email = up.email.toLowerCase();
        await user.save();
        patient.email = up.email.toLowerCase();
    }
    await patient.save();
    res.json(patient);
});

// Patient upload avatar (profile photo)
router.post('/me/avatar', protect, uploadAvatar.single('avatar'), async (req, res) => {
    const user = await User.findById(req.userId).select('email');
    if (!user) return res.status(404).json({ error: 'User not found' });
    const patient = await req.db(Patient).findOne({ email: { $regex: new RegExp(`^${user.email}$`, 'i') } });
    if (!patient) return res.status(404).json({ error: 'Patient record not found' });
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    // Save avatar URL
    try {
        const cldObj = await uploadToCloudinary(req.file.buffer, 'patients', 'image')
        patient.avatarUrl = cldObj.secure_url // Cloudinary secure_url
        await patient.save();
        res.status(201).json({ avatarUrl: patient.avatarUrl });
    } catch (e) {
        return res.status(500).json({ error: 'Avatar upload failed', detail: e.message })
    }
});

// Patient delete own report
router.delete('/me/reports/:reportId', protect, async (req, res) => {
    const user = await User.findById(req.userId).select('email');
    if (!user) return res.status(404).json({ error: 'User not found' });
    const patient = await req.db(Patient).findOne({ email: { $regex: new RegExp(`^${user.email}$`, 'i') } });
    if (!patient) return res.status(404).json({ error: 'Patient record not found' });
    const { reportId } = req.params;
    const initialLength = (patient.digitalReports || []).length;
    patient.digitalReports = (patient.digitalReports || []).filter(r => String(r._id || r.id) !== String(reportId));
    if (patient.digitalReports.length === initialLength) {
        return res.status(404).json({ error: 'Report not found' });
    }
    await patient.save();
    res.json({ message: 'Report deleted' });
});

// @desc    Get aggregated patient profile page data (patient, prescriptions, appointments, wards, prescription templates)
// @route   GET /api/patients/:id/profile
// @access  Private/Doctor
router.get('/:id/profile', protect, doctor, loadTenant, async (req, res) => {
    try {
        const tenantId = req.tenant ? req.tenant._id : (req.user ? req.user.tenantId : undefined)
        const patientId = req.params.id

        // Fetch patient
        const patient = await req.db(Patient).findOne({ _id: patientId, tenantId }).populate('prescriptions');
        if (!patient) return res.status(404).json({ error: 'Patient not found' })

        // Fetch prescriptions
        const prescriptionsPromise = req.db(Prescription).find({ patient: patientId }).populate('doctor', 'name');

        // Fetch appointments
        let appointments = []
        if (req.user && req.user.role === 'doctor') {
            const q = { doctor: req.userId }
            if (patient.email) q.patientEmail = patient.email
            else if (patient.firstName) q.patientName = new RegExp(`^${patient.firstName}`, 'i')
            if (tenantId) q.tenantId = tenantId
            appointments = await req.db(Appointment).find(q).sort({ slotStart: -1 })
        }

        // Fetch wards
        const wardsPromise = req.db(Ward).find(tenantId ? { tenantId } : {})

        // Fetch prescription templates
        const templatesPromise = req.db(PrescriptionTemplate).find(tenantId ? { tenantId } : {})

        const [prescriptions, wards, templates] = await Promise.all([
            prescriptionsPromise,
            wardsPromise,
            templatesPromise
        ])

        res.json({
            patient,
            prescriptions,
            appointments,
            wards,
            templates
        })
    } catch (e) {
        console.error('Patient profile aggregation error', e)
        res.status(500).json({ error: 'Server error' })
    }
});

// @desc    Get patient by ID
// @route   GET /api/patients/:id
// @access  Private/Doctor
router.get('/:id', protect, doctor, loadTenant, async (req, res) => {
    try {
        const tenantId = req.tenant ? req.tenant._id : (req.user ? req.user.tenantId : undefined)
        const patient = await req.db(Patient).findOne({ _id: req.params.id, tenantId }).populate('prescriptions');
        if (patient) return res.json(patient)
        return res.status(404).json({ error: 'Patient not found' })
    } catch (e) {
        console.error(e)
        if (e && e.code === 11000) {
            return res.status(400).json({ error: 'Patient with this email already exists' })
        }
        res.status(500).json({ error: 'Server error' })
    }
});

// @desc    Register a new patient (tenant-scoped)
// @route   POST /api/patients
// @access  Private/Doctor/Admin/Subadmin
router.post('/', protect, loadTenant, allowRolesWithSubadminFeature(['doctor', 'admin', 'subadmin'], 'manage_patients'), enforcePlanLimit('patients'), async (req, res) => {
    try {
        const { firstName, lastName, gender, dob, phone, email, address, emergencyContact, bloodGroup } = req.body;
        const tenantId = req.tenant ? req.tenant._id : (req.user ? req.user.tenantId : undefined)
        const createdBy = req.userId
        const patient = req.db(Patient)._wrap({ firstName, lastName, gender, dob, phone, email, address, emergencyContact, bloodGroup, tenantId, createdBy });
        const createdPatient = await patient.save();
        // Send registration email to patient (best-effort).
        // Provision a user account with secure setup link (no plaintext passwords in email).
        try {
            if (email) {
                const company = process.env.COMPANY_NAME || 'HMS'
                let credentialHtml = ''
                try {
                    const existingUser = await User.findOne({ email: email.toLowerCase(), tenantId })
                    if (!existingUser) {
                        // Generate secure setup token instead of plaintext password
                        const setupToken = crypto.randomBytes(32).toString('hex')
                        const hashedSetupToken = crypto.createHash('sha256').update(setupToken).digest('hex')
                        const randomPlaceholderPass = crypto.randomBytes(16).toString('hex')
                        const passwordHash = await bcrypt.hash(randomPlaceholderPass, 10)
                        const userName = `${firstName || ''}${lastName ? ' ' + lastName : ''}`.trim() || email.split('@')[0]
                        const userDoc = await User.create({
                            name: userName,
                            email: email.toLowerCase(),
                            passwordHash,
                            role: 'patient',
                            tenantId,
                            createdBy,
                            mustChangePassword: true,
                            passwordResetToken: hashedSetupToken,
                            passwordResetExpires: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
                        })
                        // Link the created user to the patient document
                        try {
                            createdPatient.user = userDoc._id
                            await createdPatient.save()
                        } catch (linkErr) {
                            console.warn('failed to link patient to user', linkErr?.message || linkErr)
                        }

                        // Build secure setup URL
                        const publicBase = buildPublicFrontendUrl('')
                        const setupUrl = `${publicBase}/reset-password?token=${setupToken}&email=${encodeURIComponent(email)}`

                        credentialHtml = `<h3>Patient Portal Login</h3>
                            <p>An account has been created for you at <strong>${company}</strong>.</p>
                            <p><strong>Login Email:</strong> ${email}</p>
                            <p style="text-align:center;margin:24px 0;"><a href="${setupUrl}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:10px 18px;border-radius:6px;font-size:14px;font-weight:600;">Set Your Password</a></p>
                            <p>This secure setup link will expire in 24 hours. Please set your password to access the patient portal.</p>
                            <p>If you did not expect this, contact your clinic administrator.</p>`
                    } else {
                        // existing user found - link to patient record (but do not include password)
                        try {
                            createdPatient.user = existingUser._id
                            await createdPatient.save()
                        } catch (linkErr) {
                            console.warn('failed to link existing user to patient', linkErr?.message || linkErr)
                        }
                        credentialHtml = `<p>An account already exists for this email. Use your existing credentials to sign in to the patient portal.</p>`
                    }
                } catch (e) {
                    console.warn('provision patient user failed', e?.message || e)
                }

                const subject = `${company}: Patient Registration`;
                const html = `<p>Dear ${firstName || 'Patient'},</p>
                    <p>Your record has been created at <strong>${company}</strong>. You can use your email (<strong>${email}</strong>) to access patient features if available.</p>
                    ${credentialHtml}
                    <p>If you did not request this, please contact the clinic.</p>`;

                const regRes = await sendEmail(email, subject, html);
                if (!regRes || !regRes.ok) {
                    console.warn('patient registration email failed or queued', regRes?.error || '', regRes?.savedTo || '')
                }
            }
        } catch (e) { console.warn('sendEmail error', e?.message || e) }
        triggerBackgroundUpdate(tenantId)
        res.status(201).json(createdPatient);
    } catch (e) {
        console.error(e)
        res.status(500).json({ error: 'Server error' })
    }
});

// @desc    Update patient information
// @route   PUT /api/patients/:id
// @access  Private/Doctor/Admin/Subadmin
router.put('/:id', protect, loadTenant, allowRolesWithSubadminFeature(['doctor', 'admin', 'subadmin'], 'manage_patients'), async (req, res) => {
    try {
        const tenantId = req.tenant ? req.tenant._id : (req.user ? req.user.tenantId : undefined)
        const patient = await req.db(Patient).findOne({ _id: req.params.id, tenantId })
        if (!patient) return res.status(404).json({ error: 'Patient not found' })
        patient.firstName = req.body.firstName || patient.firstName;
        patient.lastName = req.body.lastName || patient.lastName;
        patient.gender = req.body.gender || patient.gender;
        patient.dob = req.body.dob || patient.dob;
        patient.phone = req.body.phone || patient.phone;
        patient.email = req.body.email || patient.email;
        patient.address = req.body.address || patient.address;
        patient.emergencyContact = req.body.emergencyContact || patient.emergencyContact;
        patient.bloodGroup = req.body.bloodGroup || patient.bloodGroup;
        patient.medicalHistory = req.body.medicalHistory || patient.medicalHistory;
        patient.allergies = req.body.allergies || patient.allergies;
        const updatedPatient = await patient.save();
        triggerBackgroundUpdate(tenantId)
        res.json(updatedPatient);
    } catch (e) {
        console.error(e)
        res.status(500).json({ error: 'Server error' })
    }
});

// @desc    Delete patient record
// @route   DELETE /api/patients/:id
// @access  Private/Doctor/Admin/Subadmin
router.delete('/:id', protect, loadTenant, allowRolesWithSubadminFeature(['doctor', 'admin', 'subadmin'], 'manage_patients'), async (req, res) => {
    try {
        const tenantId = req.tenant ? req.tenant._id : (req.user ? req.user.tenantId : undefined)
        const patient = await req.db(Patient).findOne({ _id: req.params.id, tenantId })
        if (!patient) return res.status(404).json({ error: 'Patient not found' })
        // Attempt to notify patient about account removal (best-effort)
        try {
            if (patient.email) {
                const company = process.env.COMPANY_NAME || 'HMS'
                const subject = `${company}: Patient Account Removed`
                const html = `<p>Dear ${patient.firstName || 'Patient'},</p><p>Your patient record at <strong>${company}</strong> has been removed by the clinic administrator. If you believe this is a mistake, please contact the clinic.</p><p>Regards,<br/>${company} Team</p>`
                await sendEmail(patient.email, subject, html).catch(e => console.warn('deletion email failed', e?.message || e))
            }
        } catch (e) {
            console.warn('failed to send patient deletion email', e?.message || e)
        }

        // Attempt to remove associated uploaded report files
        // We do not delete files from Cloudinary automatically to preserve logs.
        // Delete the patient document (use model deleteOne for compatibility)
        await Patient.deleteOne({ _id: req.params.id, tenantId });
        triggerBackgroundUpdate(tenantId)
        res.json({ message: 'Patient deleted' })
    } catch (e) {
        console.error(e)
        res.status(500).json({ error: 'Server error' })
    }
});

// @desc    Upload digital report
// @route   POST /api/patients/:id/reports
// @access  Private/Doctor/Admin/Subadmin
router.post('/:id/reports', protect, loadTenant, allowRolesWithSubadminFeature(['doctor', 'admin', 'subadmin'], 'manage_patients'), upload.single('report'), async (req, res) => {
    try {
        const tenantId = req.tenant ? req.tenant._id : (req.user ? req.user.tenantId : undefined)
        const patient = await req.db(Patient).findOne({ _id: req.params.id, tenantId })
        if (patient) {
            if (!req.file) return res.status(400).json({ error: 'No report file provided' })
            const cldObj = await uploadToCloudinary(req.file.buffer, 'patients', 'auto')
            const report = {
                _id: crypto.randomUUID(),
                title: req.body.title,
                url: cldObj.secure_url, // Cloudinary secure_url
                mimeType: req.file.mimetype,
                size: req.file.size,
                originalName: req.file.originalname,
                uploadedAt: new Date()
            };
            patient.digitalReports.push(report);
            await patient.save();
            res.status(201).json(report);
        } else {
            res.status(404).json({ error: 'Patient not found' })
        }
    } catch (e) {
        console.error(e)
        res.status(500).json({ error: 'Server error' })
    }
});


// @desc    Assign bed to patient
// @route   POST /api/patients/:id/assign-bed
// @access  Private/Doctor
router.post('/:id/assign-bed', protect, doctor, async (req, res) => {
    const { bedId } = req.body;
    const patient = await req.db(Patient).findById(req.params.id);
    const bed = await req.db(Bed).findById(bedId).populate('ward');

    if (patient && bed) {
        if (bed.isOccupied) {
            res.status(400);
            throw new Error('Bed is already occupied');
        }
        patient.inpatient.isAdmitted = true;
        patient.inpatient.bed = bedId;
        patient.inpatient.ward = bed.ward._id;
        patient.inpatient.admittedAt = new Date();
        await patient.save();

        bed.isOccupied = true;
        bed.patient = patient._id;
        await bed.save();

        if (bed.ward) {
            const ward = await req.db(Ward).findById(bed.ward._id);
            if (ward) {
                const occupiedCount = await req.db(Bed).countDocuments({ ward: ward._id, isOccupied: true });
                ward.currentOccupancy = occupiedCount;
                await ward.save();
            }
        }

        // Create an invoice for the bed charge
        if (bed.ward.pricePerDay > 0) {
            const invoiceItem = {
                description: `Room charge: ${bed.ward.name} - ${bed.bedNumber}`,
                quantity: 1,
                unitPrice: bed.ward.pricePerDay,
                gstRate: 0, // Assuming no GST on room charges for now
            };
            const subtotal = invoiceItem.unitPrice * invoiceItem.quantity;
            const total = subtotal;
            const invoice = req.db(Invoice)._wrap({
                patientName: `${patient.firstName} ${patient.lastName}`,
                items: [invoiceItem],
                subtotal,
                gstTotal: 0,
                total,
            });
            await invoice.save();
        }

        res.json({ message: 'Bed assigned successfully' });
    } else {
        res.status(404);
        throw new Error('Patient or Bed not found');
    }
});

// @desc    Discharge patient
// @route   POST /api/patients/:id/discharge
// @access  Private/Doctor
router.post('/:id/discharge', protect, doctor, async (req, res) => {
    const { summary, referral } = req.body;
    const patient = await req.db(Patient).findById(req.params.id);
    if (!patient || !patient.inpatient.isAdmitted) {
        return res.status(404).json({ error: 'Admitted patient not found' });
    }
    const bed = await req.db(Bed).findById(patient.inpatient.bed);
    const ward = await req.db(Ward).findById(patient.inpatient.ward);
    // Release bed
    if (bed) {
        bed.isOccupied = false;
        bed.patient = null;
        await bed.save();
    }
    if (ward) {
        const occupiedCount = await req.db(Bed).countDocuments({ ward: ward._id, isOccupied: true });
        ward.currentOccupancy = occupiedCount;
        await ward.save();
    }
    // Calculate stay duration for additional billing
    const admittedAt = patient.inpatient.admittedAt ? new Date(patient.inpatient.admittedAt) : new Date();
    const dischargedAt = new Date();
    const msPerDay = 24 * 60 * 60 * 1000;
    let totalDays = Math.ceil(Math.max(1, (dischargedAt - admittedAt) / msPerDay));
    if (!ward) totalDays = 1; // fallback if ward missing
    const dailyRate = ward?.pricePerDay || 250;
    // First day already invoiced at admission; bill remaining days if >1
    const remainingDays = totalDays > 1 ? (totalDays - 1) : 0;
    let invoiceId = null;
    if (remainingDays > 0) {
        const subtotal = remainingDays * dailyRate;
        const invoice = req.db(Invoice)._wrap({
            patientName: `${patient.firstName}${patient.lastName ? ' ' + patient.lastName : ''}`,
            patient: patient._id,
            items: [{ description: `Room charge (additional days): ${ward?.name || 'Ward'} - ${remainingDays} day(s)`, quantity: remainingDays, unitPrice: dailyRate, gstRate: 0 }],
            subtotal,
            gstTotal: 0,
            total: subtotal,
            notes: 'Discharge additional days',
            createdBy: req.userId,
            createdByRole: 'doctor'
        });
        await invoice.save();
        invoiceId = invoice._id;
    }
    // Update patient record
    patient.inpatient.isAdmitted = false;
    patient.inpatient.dischargeSummary = summary;
    patient.inpatient.referral = referral;
    await patient.save();

    // Email notification
    if (patient.email && ward && bed) {
        try {
            const { html, attachments } = bedDischargeTemplate({ patient, ward, bed, totalDays, totalCost: totalDays * dailyRate, dischargedAt });
            await sendEmail(patient.email, `${process.env.COMPANY_NAME || 'PharmaPlus HMS'}: Discharge Summary`, html, attachments?.length ? { attachments } : undefined);
        } catch (e) {
            console.warn('discharge email failed:', e?.message || e);
        }
    }
    res.json({ message: 'Patient discharged successfully', totalDays, remainingDays, invoiceId });
});

export default router;
