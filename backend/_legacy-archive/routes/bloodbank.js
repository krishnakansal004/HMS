import express from 'express';
import BloodDonor from '../models/BloodDonor.js';
import BloodInventory from '../models/BloodInventory.js';
import BloodRequest from '../models/BloodRequest.js';
import Patient from '../models/Patient.js';
import { protect } from '../utils/auth.js';
import { loadTenant } from '../utils/saas.js';
import { allowRolesWithSubadminFeature } from '../utils/permissions.js';
import { logActivity } from '../utils/auditHelper.js';

const router = express.Router();

// ─── DONOR REGISTRY ──────────────────────────────────────────────────────

// @desc    Get all blood donors
// @route   GET /api/bloodbank/donors
router.get('/donors', protect, loadTenant, async (req, res) => {
    try {
        const donors = await req.db(BloodDonor).find({});
        res.json(donors);
    } catch (e) {
        res.status(500).json({ error: 'Failed to load donors list' });
    }
});

// @desc    Register a new donor
// @route   POST /api/bloodbank/donors
router.post('/donors', protect, loadTenant, allowRolesWithSubadminFeature(['admin', 'subadmin', 'staff'], 'manage_bloodbank'), async (req, res) => {
    try {
        const { name, bloodGroup, age, gender, phone, email, lastDonationDate, pulse, bloodPressure, weight } = req.body;
        const tenantId = req.tenant?._id || req.user?.tenantId;

        const donor = await req.db(BloodDonor).create({
            tenantId,
            name,
            bloodGroup,
            age: Number(age),
            gender,
            phone,
            email,
            lastDonationDate: lastDonationDate ? new Date(lastDonationDate) : null,
            vitals: { pulse, bloodPressure, weight },
            status: 'cleared',
            createdBy: req.userId
        });

        await logActivity(req, 'REGISTER_BLOOD_DONOR', 'blooddonor', donor._id, { name, bloodGroup });
        res.status(201).json(donor);
    } catch (e) {
        res.status(500).json({ error: 'Failed to register blood donor' });
    }
});


// ─── INVENTORY ENDPOINTS ──────────────────────────────────────────────────

// @desc    Get blood inventory details
// @route   GET /api/bloodbank/inventory
router.get('/inventory', protect, loadTenant, async (req, res) => {
    try {
        const bags = await req.db(BloodInventory).find({});
        res.json(bags);
    } catch (e) {
        res.status(500).json({ error: 'Failed to load blood inventory' });
    }
});

// @desc    Add blood bag to inventory
// @route   POST /api/bloodbank/inventory
router.post('/inventory', protect, loadTenant, allowRolesWithSubadminFeature(['admin', 'subadmin', 'staff'], 'manage_bloodbank'), async (req, res) => {
    try {
        const { bagNumber, bloodGroup, volumeMl, donorId } = req.body;
        const tenantId = req.tenant?._id || req.user?.tenantId;

        const collectionDate = new Date();
        const expiryDate = new Date();
        expiryDate.setDate(collectionDate.getDate() + 35); // Whole blood has 35 days shelf life

        const bag = await req.db(BloodInventory).create({
            tenantId,
            bagNumber,
            bloodGroup,
            volumeMl: Number(volumeMl || 350),
            collectionDate,
            expiryDate,
            donor: donorId || null,
            status: 'available', // available -> reserved -> issued -> expired
            createdBy: req.userId
        });

        await logActivity(req, 'ADD_BLOOD_INVENTORY', 'bloodinventory', bag._id, { bagNumber, bloodGroup });
        res.status(201).json(bag);
    } catch (e) {
        res.status(500).json({ error: 'Failed to add blood bag to inventory' });
    }
});


// ─── BLOOD REQUESTS & ISSUE ────────────────────────────────────────────────

// @desc    Get blood requests
// @route   GET /api/bloodbank/requests
router.get('/requests', protect, loadTenant, async (req, res) => {
    try {
        const q = {};
        if (req.user?.role === 'patient') {
            const patient = await req.db(Patient).findOne({ email: req.user.email });
            if (!patient) return res.json([]);
            q.patient = patient._id;
        }
        const requests = await req.db(BloodRequest).find(q).sort({ createdAt: -1 });
        res.json(requests);
    } catch (e) {
        res.status(500).json({ error: 'Failed to load blood requests' });
    }
});

// @desc    Log blood request
// @route   POST /api/bloodbank/requests
router.post('/requests', protect, loadTenant, allowRolesWithSubadminFeature(['admin', 'subadmin', 'doctor'], 'manage_bloodbank'), async (req, res) => {
    try {
        const { patientId, bloodGroup, unitsRequested, urgency, doctorName } = req.body;
        const tenantId = req.tenant?._id || req.user?.tenantId;

        const patient = await req.db(Patient).findById(patientId);
        if (!patient) return res.status(404).json({ error: 'Patient not found' });

        const request = await req.db(BloodRequest).create({
            tenantId,
            patient: patientId,
            patientName: `${patient.firstName} ${patient.lastName}`,
            bloodGroup,
            unitsRequested: Number(unitsRequested || 1),
            urgency: urgency || 'routine',
            doctorName: doctorName || req.user?.name || 'Assigned Physician',
            crossmatchStatus: 'pending', // pending -> compatible -> incompatible
            status: 'pending', // pending -> crossmatching -> approved -> issued -> cancelled
            createdBy: req.userId
        });

        await logActivity(req, 'CREATE_BLOOD_REQUEST', 'bloodrequest', request._id, { patientId, bloodGroup, unitsRequested });
        res.status(201).json(request);
    } catch (e) {
        res.status(500).json({ error: 'Failed to log blood request' });
    }
});

// @desc    Crossmatch compatibility test
// @route   PUT /api/bloodbank/requests/:id/crossmatch
router.put('/requests/:id/crossmatch', protect, loadTenant, allowRolesWithSubadminFeature(['admin', 'subadmin', 'staff'], 'manage_bloodbank'), async (req, res) => {
    try {
        const { crossmatchStatus, notes } = req.body;
        const request = await req.db(BloodRequest).findById(req.params.id);
        if (!request) return res.status(404).json({ error: 'Blood request not found' });

        request.crossmatchStatus = crossmatchStatus; // compatible | incompatible
        request.technicianNotes = notes || '';
        request.status = 'crossmatching';

        const updated = await request.save();
        await logActivity(req, 'CROSSMATCH_BLOOD_REQUEST', 'bloodrequest', request._id, { crossmatchStatus });
        res.json(updated);
    } catch (e) {
        res.status(500).json({ error: 'Failed to record crossmatch details' });
    }
});

// @desc    Issue blood and decrease inventory
// @route   PUT /api/bloodbank/requests/:id/issue
router.put('/requests/:id/issue', protect, loadTenant, allowRolesWithSubadminFeature(['admin', 'subadmin', 'staff'], 'manage_bloodbank'), async (req, res) => {
    try {
        const request = await req.db(BloodRequest).findById(req.params.id);
        if (!request) return res.status(404).json({ error: 'Blood request not found' });

        if (request.crossmatchStatus !== 'compatible') {
            return res.status(400).json({ error: 'Blood compatibility test must be marked COMPATIBLE before issuing units.' });
        }

        // Find available bags matching group
        const countNeeded = request.unitsRequested;
        const availableBags = await req.db(BloodInventory).find({ bloodGroup: request.bloodGroup, status: 'available' });

        if (availableBags.length < countNeeded) {
            return res.status(400).json({ error: `Insufficient inventory. Requested ${countNeeded} units of ${request.bloodGroup}, but only ${availableBags.length} are available.` });
        }

        // Issue bags in parallel
        const issuedBags = availableBags.slice(0, countNeeded);
        await Promise.all(issuedBags.map(async (bag) => {
            bag.status = 'issued';
            bag.issuedTo = request.patient;
            bag.issuedAt = new Date();
            await bag.save();
        }));

        request.issuedBags = issuedBags.map(b => b.bagNumber);
        request.status = 'issued';
        request.issuedAt = new Date();
        request.issuedBy = req.userId;

        const updated = await request.save();
        await logActivity(req, 'ISSUE_BLOOD_REQUEST', 'bloodrequest', request._id, { issuedBags: request.issuedBags });
        res.json(updated);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Failed to issue blood units' });
    }
});

export default router;
