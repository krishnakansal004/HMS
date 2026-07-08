import express from 'express';
import Ward from '../models/Ward.js';
import Bed from '../models/Bed.js';
import { protect, admin } from '../utils/auth.js';
import { loadTenant } from '../utils/saas.js';
import { allowRolesWithSubadminFeature } from '../utils/permissions.js';
import Patient from '../models/Patient.js';
import Invoice from '../models/Invoice.js';
import { sendEmail } from '../utils/notify.js';
import { bedAllocationTemplate } from '../utils/emailTemplates.js';

const router = express.Router();

// WARD ROUTES

// @desc    Get all wards (with availability stats)
// @route   GET /api/wards
// @access  Private
router.get('/', protect, loadTenant, async (req, res) => {
    const q = {}
    if (req.tenant) q.tenantId = req.tenant._id
    const wards = await req.db(Ward).find(q);
    const wardIds = wards.map(w => w._id);
    const beds = await req.db(Bed).find({ ward: { $in: wardIds } });
    const byWard = {};
    beds.forEach(b => {
        const id = b.ward.toString();
        if (!byWard[id]) byWard[id] = { total: 0, available: 0 };
        byWard[id].total += 1;
        if (!b.isOccupied) byWard[id].available += 1;
    });
    const enriched = wards.map(w => {
        const stats = byWard[w._id.toString()] || { total: 0, available: 0 };
        return {
            _id: w._id,
            name: w.name,
            type: w.type,
            floor: w.floor,
            capacity: w.capacity,
            currentOccupancy: w.currentOccupancy,
            pricePerDay: w.pricePerDay,
            isActive: w.isActive,
            notes: w.notes,
            createdAt: w.createdAt,
            updatedAt: w.updatedAt,
            totalBeds: stats.total,
            availableBeds: stats.available
        };
    });
    res.json(enriched);
});

// @desc    Create a ward (auto-generates beds up to capacity)
// @route   POST /api/wards
// @access  Private/Admin/Subadmin
router.post('/', protect, allowRolesWithSubadminFeature(['admin','director','subadmin'], 'manage_wards'), loadTenant, async (req, res) => {
    const { name, type, floor, notes, isActive } = req.body || {};
    const cap = Number(req.body.capacity)
    const price = Number(req.body.pricePerDay)
    const effectiveCapacity = (!isNaN(cap) && cap > 0) ? cap : undefined;
    const tenantId = req.tenant ? req.tenant._id : (req.user ? req.user.tenantId : undefined)
    const ward = req.db(Ward)._wrap({ tenantId, name, type, floor, capacity: effectiveCapacity, pricePerDay: !isNaN(price) ? price : 0, notes, isActive });
    const createdWard = await ward.save();
    try {
        const total = createdWard.capacity;
        if (total && total > 0) {
            const prefix = (createdWard.name || 'WARD').replace(/\s+/g, '').toUpperCase().slice(0, 3);
            // FirestoreModel has no insertMany — save individually
            for (let i = 1; i <= total; i++) {
                const bed = req.db(Bed)._wrap({ bedNumber: `${prefix}-${String(i).padStart(3,'0')}`, ward: createdWard._id, isOccupied: false, allocations: [] });
                await bed.save();
            }
        }
    } catch (e) {
        console.error('[wards] auto bed generation failed', e);
    }
    res.status(201).json(createdWard);
});

// @desc    Update a ward
// @route   PUT /api/wards/:id
// @access  Private/Admin/Subadmin
router.put('/:id', protect, allowRolesWithSubadminFeature(['admin','director','subadmin'], 'manage_wards'), loadTenant, async (req, res) => {
    try {
        // Firestore cannot combine documentId() with other field filters
        const ward = await req.db(Ward).findById(req.params.id)
        if (!ward) return res.status(404).json({ error: 'Ward not found' });
        if (req.tenant && String(ward.tenantId) !== String(req.tenant._id)) return res.status(404).json({ error: 'Ward not found' });
        const { name, type, floor, capacity, pricePerDay, notes, isActive } = req.body || {};
        if (name !== undefined) ward.name = name;
        if (type !== undefined) ward.type = type;
        if (floor !== undefined) ward.floor = floor;
        if (capacity !== undefined && capacity > 0) ward.capacity = capacity;
        if (pricePerDay !== undefined) ward.pricePerDay = pricePerDay;
        if (notes !== undefined) ward.notes = notes;
        if (isActive !== undefined) ward.isActive = isActive;
        const updated = await ward.save();
        res.json(updated);
    } catch (e) {
        console.error('[wards] update error', e);
        res.status(500).json({ error: 'Failed to update ward' });
    }
});

// @desc    Toggle ward active status
// @route   PATCH /api/wards/:id/live
// @access  Private/Admin/Subadmin
router.patch('/:id/live', protect, allowRolesWithSubadminFeature(['admin','director','subadmin'], 'manage_wards'), loadTenant, async (req, res) => {
    try {
        // Firestore cannot combine documentId() with other field filters
        const ward = await req.db(Ward).findById(req.params.id)
        if (!ward) return res.status(404).json({ error: 'Ward not found' });
        if (req.tenant && String(ward.tenantId) !== String(req.tenant._id)) return res.status(404).json({ error: 'Ward not found' });
        ward.isActive = req.body.isActive === undefined ? !ward.isActive : !!req.body.isActive;
        const updated = await ward.save();
        res.json({ id: ward._id, isActive: updated.isActive });
    } catch (e) {
        console.error('[wards] live toggle error', e);
        res.status(500).json({ error: 'Failed to toggle ward' });
    }
});

// BED ROUTES

// @desc    Get all beds in a ward
// @route   GET /api/wards/:wardId/beds
// @access  Private
router.get('/:wardId/beds', protect, loadTenant, async (req, res) => {
    // Firestore cannot combine documentId() with other field filters
    const ward = await req.db(Ward).findById(req.params.wardId)
    if (!ward) return res.status(404).json({ error: 'Ward not found' })
    if (req.tenant && String(ward.tenantId) !== String(req.tenant._id)) return res.status(404).json({ error: 'Ward not found' })
    const beds = await req.db(Bed).find({ ward: req.params.wardId }).populate({
        path: 'patient',
        select: 'firstName lastName email phone inpatient'
    });
    res.json(beds);
});

// @desc    Get occupied bed allocations (patient enriched)
// @route   GET /api/wards/:wardId/allocations
// @access  Private
router.get('/:wardId/allocations', protect, loadTenant, async (req, res) => {
    // Firestore cannot combine documentId() with other field filters
    const ward = await req.db(Ward).findById(req.params.wardId)
    if (!ward) return res.status(404).json({ error: 'Ward not found' })
    if (req.tenant && String(ward.tenantId) !== String(req.tenant._id)) return res.status(404).json({ error: 'Ward not found' })
    const beds = await req.db(Bed).find({ ward: req.params.wardId, isOccupied: true }).populate({
        path: 'patient',
        select: 'firstName lastName email phone inpatient'
    });
    res.json(beds.map(b => ({
        bedId: b._id,
        bedNumber: b.bedNumber,
        patient: b.patient ? {
            id: b.patient._id,
            name: `${b.patient.firstName}${b.patient.lastName ? ' ' + b.patient.lastName : ''}`,
            email: b.patient.email,
            phone: b.patient.phone,
            admittedAt: b.patient.inpatient?.admittedAt || null
        } : null
    })));
});

// @desc    Get ward allocation history (all beds allocations)
// @route   GET /api/wards/:wardId/history
// @access  Private
router.get('/:wardId/history', protect, loadTenant, async (req, res) => {
    try {
        // Firestore cannot combine documentId() with other field filters
        const ward = await req.db(Ward).findById(req.params.wardId)
        if (!ward) return res.status(404).json({ error: 'Ward not found' })
        if (req.tenant && String(ward.tenantId) !== String(req.tenant._id)) return res.status(404).json({ error: 'Ward not found' })
        // find beds in ward and aggregate their allocations
        const beds = await req.db(Bed).find({ ward: req.params.wardId }).populate('allocations.patient', 'firstName lastName email phone');
        const history = [];
        beds.forEach(b => {
            const bedNumber = b.bedNumber;
            (b.allocations || []).forEach(a => {
                history.push({
                    bedId: b._id,
                    bedNumber,
                    patient: a.patient ? { id: a.patient._id, name: `${a.patient.firstName} ${a.patient.lastName || ''}`, email: a.patient.email, phone: a.patient.phone } : { name: a.name, email: a.email, phone: a.phone },
                    admitFrom: a.admitFrom,
                    admitUntil: a.admitUntil,
                    allocatedAt: a.allocatedAt,
                    releasedAt: a.releasedAt,
                    authority: a.authority,
                    priceCharged: a.priceCharged,
                    invoice: a.invoice
                })
            })
        })
        // sort by allocatedAt desc
        history.sort((x,y)=> (y.allocatedAt || 0) - (x.allocatedAt || 0))
        res.json(history)
    } catch (e) {
        console.error('[wards] history error', e)
        res.status(500).json({ error: 'Failed to fetch history' })
    }
})

// @desc    Create a bed in a ward
// @route   POST /api/wards/:wardId/beds
// @access  Private/Admin
router.post('/:wardId/beds', protect, allowRolesWithSubadminFeature(['admin','director','subadmin'], 'manage_wards'), loadTenant, async (req, res) => {
    try {
        // Firestore cannot combine documentId() with other field filters
        const ward = await req.db(Ward).findById(req.params.wardId)
        if (!ward) return res.status(404).json({ error: 'Ward not found' })
        if (req.tenant && String(ward.tenantId) !== String(req.tenant._id)) return res.status(404).json({ error: 'Ward not found' })
        const existingCount = await req.db(Bed).countDocuments({ ward: ward._id });
        if (existingCount >= ward.capacity) return res.status(400).json({ error: 'Ward capacity reached' });
        // Auto-generate bedNumber if not provided: PREFIX-### based on ward name
        let { bedNumber } = req.body;
        if (!bedNumber) {
            const prefix = (ward.name || 'WARD').replace(/\s+/g, '').toUpperCase().slice(0,3);
            bedNumber = `${prefix}-${String(existingCount + 1).padStart(3,'0')}`;
        }
        const bed = req.db(Bed)._wrap({ bedNumber, ward: ward._id });
        const createdBed = await bed.save();
        // currentOccupancy is occupied beds; creating an empty bed does not change it
        res.status(201).json(createdBed);
    } catch (e) {
        console.error('[wards] create bed error', e);
        res.status(500).json({ error: 'Failed to create bed' });
    }
});

// @desc    Bulk add beds to a ward
// @route   POST /api/wards/:wardId/beds/bulk
// @access  Private/Admin
router.post('/:wardId/beds/bulk', protect, allowRolesWithSubadminFeature(['admin','director','subadmin'], 'manage_wards'), loadTenant, async (req, res) => {
    try {
        const { beds } = req.body; // array of bedNumber strings
        if (!Array.isArray(beds) || beds.length === 0) return res.status(400).json({ error: 'Provide an array of bed numbers' });
        // Firestore cannot combine documentId() with other field filters
        const ward = await req.db(Ward).findById(req.params.wardId)
        if (!ward) return res.status(404).json({ error: 'Ward not found' });
        if (req.tenant && String(ward.tenantId) !== String(req.tenant._id)) return res.status(404).json({ error: 'Ward not found' });
        const existingCount = await req.db(Bed).countDocuments({ ward: ward._id });
        if (existingCount + beds.length > ward.capacity) return res.status(400).json({ error: 'Adding beds exceeds ward capacity' });
        const toInsert = beds.map(b => ({ bedNumber: b, ward: ward._id }));
        const inserted = [];
        for (const b of beds) {
            const bed = req.db(Bed)._wrap({ bedNumber: b, ward: ward._id });
            const saved = await bed.save();
            inserted.push(saved);
        }
        // Adding empty beds does not change occupied count; leave currentOccupancy untouched
        res.status(201).json(inserted);
    } catch (e) {
        console.error('[wards] bulk beds error', e);
        res.status(500).json({ error: 'Failed to bulk create beds' });
    }
});

// @desc    Remove a bed
// @route   DELETE /api/wards/:wardId/beds/:bedId
// @access  Private/Admin
router.delete('/:wardId/beds/:bedId', protect, allowRolesWithSubadminFeature(['admin','director','subadmin'], 'manage_wards'), loadTenant, async (req, res) => {
    try {
        // Firestore cannot combine documentId() with other field filters
        const ward = await req.db(Ward).findById(req.params.wardId)
        if (!ward) return res.status(404).json({ error: 'Ward not found' })
        if (req.tenant && String(ward.tenantId) !== String(req.tenant._id)) return res.status(404).json({ error: 'Ward not found' })
        const bed = await req.db(Bed).findById(req.params.bedId);
        if (!bed || bed.ward.toString() !== req.params.wardId) return res.status(404).json({ error: 'Bed not found in ward' });
        await bed.deleteOne();
        if (ward) {
            const occupiedCount = await req.db(Bed).countDocuments({ ward: ward._id, isOccupied: true });
            ward.currentOccupancy = occupiedCount;
            await ward.save();
        }
        res.json({ message: 'Bed removed' });
    } catch (e) {
        console.error('[wards] delete bed error', e);
        res.status(500).json({ error: 'Failed to remove bed' });
    }
});

// @desc    Allocate bed (registered or new patient)
// @route   POST /api/wards/:wardId/allocate
// @access  Private (admin, doctor, staff)
router.post('/:wardId/allocate', protect, loadTenant, async (req, res) => {
    try {
        const { mode, patientId, firstName, lastName, email, phone, bedId, authority, admitFrom, admitUntil } = req.body || {};
        const wardId = req.params.wardId;
        if (!wardId || typeof wardId !== 'string' || wardId.startsWith('temp-') || !wardId.match(/^[a-zA-Z0-9_\-]{15,40}$/)) {
            return res.status(400).json({ error: 'Invalid or unsynced wardId' });
        }
        if (!bedId || typeof bedId !== 'string' || bedId.startsWith('temp-') || !bedId.match(/^[a-zA-Z0-9_\-]{15,40}$/)) {
            return res.status(400).json({ error: 'Invalid or unsynced bedId' });
        }
        // Firestore cannot combine documentId() with other field filters
        const ward = await req.db(Ward).findById(wardId)
        if (!ward) return res.status(404).json({ error: 'Ward not found' });
        if (req.tenant && String(ward.tenantId) !== String(req.tenant._id)) return res.status(404).json({ error: 'Ward not found' });
        const bed = await req.db(Bed).findById(bedId);
        // Firestore IDs may be stored as plain strings — compare both
        const bedWardId = bed ? String(bed.ward || bed.wardId || '') : '';
        const wardStrId = String(ward._id || ward.id || '');
        if (!bed || (bedWardId && wardStrId && bedWardId !== wardStrId)) return res.status(404).json({ error: 'Bed not found in ward' });
        if (bed.isOccupied) return res.status(400).json({ error: 'Bed already occupied' });

        const role = req.userRole || req.user?.role;
        if (!['admin','doctor','staff','subadmin'].includes(role)) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        let patient;
        if (mode === 'registered') {
            if (!patientId) return res.status(400).json({ error: 'patientId required for registered mode' });
            patient = await req.db(Patient).findOne({ _id: patientId, });
            if (!patient) return res.status(404).json({ error: 'Patient not found' });
            if (patient.inpatient.isAdmitted) return res.status(400).json({ error: 'Patient already admitted' });
        } else if (mode === 'new') {
            if (!firstName || !email) return res.status(400).json({ error: 'firstName and email required for new patient' });
            // If a patient already exists by this email and is not admitted, reuse that record
            const existing = await req.db(Patient).findOne({ email, });
            if (existing) {
                if (existing.inpatient.isAdmitted) return res.status(400).json({ error: 'Existing patient with this email already admitted' });
                patient = existing;
                // Optionally update missing phone/name parts
                if (!patient.phone && phone) patient.phone = phone;
                if (!patient.lastName && lastName) patient.lastName = lastName;
                if (!patient.firstName && firstName) patient.firstName = firstName;
                await patient.save();
            } else {
                patient = await req.db(Patient).create({ 
                    firstName, lastName, email, phone, 
                    inpatient: { isAdmitted: false } 
                });
            }
        } else {
            return res.status(400).json({ error: 'Invalid mode' });
        }

        // compute admitFrom/admitUntil and price for duration (min 1 day)
        const now = new Date();
        const admitFromDate = admitFrom ? new Date(admitFrom) : now;
        const admitUntilDate = admitUntil ? new Date(admitUntil) : null;
        const dailyCost = ward.pricePerDay || 250;
        let days = 1;
        if (admitUntilDate) {
            const ms = admitUntilDate - admitFromDate;
            days = Math.max(1, Math.ceil(ms / (1000 * 60 * 60 * 24)));
        }
        const subtotal = dailyCost * days;

        // mark bed occupied and attach patient
        bed.isOccupied = true;
        bed.patient = patient._id;

        // create allocation record to push into bed.allocations
        const allocationRecord = {
            patient: patient._id,
            name: `${patient.firstName}${patient.lastName ? ' ' + patient.lastName : ''}`,
            email: patient.email,
            phone: patient.phone,
            admitFrom: admitFromDate,
            admitUntil: admitUntilDate,
            allocatedAt: new Date(),
            authority,
            priceCharged: subtotal
        };

        // save invoice referencing computed subtotal
        const invoiceItem = {
            description: `Room charge: ${ward.name} - ${bed.bedNumber}`,
            quantity: days,
            unitPrice: dailyCost,
            gstRate: 0
        };
        const invoiceTenantId = (req.tenant ? req.tenant._id : null) || req.tenantId || null;
        const invoice = req.db(Invoice)._wrap({
            patientName: `${patient.firstName}${patient.lastName ? ' ' + patient.lastName : ''}`,
            patient: patient._id,
            items: [invoiceItem],
            subtotal,
            gstTotal: 0,
            total: subtotal,
            notes: `Room charge for ${days} day(s)`,
            createdBy: req.userId,
            createdByRole: role,
            ...(invoiceTenantId ? { tenantId: invoiceTenantId } : {}),
            });
        await invoice.save();
        allocationRecord.invoice = invoice._id;

        // persist bed allocation and patient inpatient
        bed.allocations = bed.allocations || [];
        bed.allocations.push(allocationRecord);
        await bed.save();

        patient.inpatient.isAdmitted = true;
        patient.inpatient.ward = ward._id;
        patient.inpatient.bed = bed._id;
        patient.inpatient.admittedAt = admitFromDate || new Date();
        await patient.save();

        if (patient.email) {
            try {
                const { html, attachments } = bedAllocationTemplate({ patient, ward, bed, dailyCost, authority, admitFrom: admitFromDate, admitUntil: admitUntilDate, days, subtotal });
                await sendEmail(patient.email, `${process.env.COMPANY_NAME || 'PharmaPlus HMS'}: Bed Allocation`, html, attachments?.length ? { attachments } : undefined);
            } catch (e) {
                console.warn('bed allocation email failed:', e?.message || e);
            }
        }

        // Update ward occupied count
        const occupiedCount = await req.db(Bed).countDocuments({ ward: ward._id, isOccupied: true });
        ward.currentOccupancy = occupiedCount;
        await ward.save();
        res.status(201).json({
            message: 'Bed allocated',
            patient: {
                id: patient._id,
                name: `${patient.firstName}${patient.lastName ? ' ' + patient.lastName : ''}`,
                email: patient.email,
                phone: patient.phone
            },
            bed: { id: bed._id, bedNumber: bed.bedNumber },
            ward: { id: ward._id, name: ward.name },
            occupiedBeds: occupiedCount,
            invoiceId: invoice._id
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Allocation failed' });
    }
});

export default router;
