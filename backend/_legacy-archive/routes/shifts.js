import express from 'express';
import Shift from '../models/Shift.js';
import Staff from '../models/Staff.js';
import Ward from '../models/Ward.js';
import { protect, admin } from '../utils/auth.js';
import { loadTenant } from '../utils/saas.js';
import { allowAdminOrFeature } from '../utils/permissions.js';

const router = express.Router();

// @desc    Get all shifts
// @route   GET /api/shifts
// @access  Private/Admin
router.get('/', protect, allowAdminOrFeature('manage_shifts'), loadTenant, async (req, res) => {
    const q = {};
    if (req.tenant) q.tenantId = req.tenant._id;
    const shifts = await req.db(Shift).find(q).populate('ward', 'name').populate('staff', 'name');
    // ensure `staffName` exists for each returned shift (fallback)
    const out = shifts.map(s => ({
        ...s.toObject(),
        staffName: (s.staff && s.staff.name) ? s.staff.name : (s.staffName || ''),
    }))
    res.json(out);
});

// @desc    Create a new shift
// @route   POST /api/shifts
// @access  Private/Admin
router.post('/', protect, allowAdminOrFeature('manage_shifts'), loadTenant, async (req, res) => {
    const { ward, staff, startTime, endTime, staffName: providedName } = req.body;
    // require ward + time range and at least one of staff or a provided staffName
    if (!ward || !startTime || !endTime || (!staff && !providedName)) {
        return res.status(400).json({ error: 'ward, startTime, endTime and either staff or staffName are required' });
    }
    const start = new Date(startTime);
    const end = new Date(endTime);
    if (isNaN(start) || isNaN(end) || end <= start) {
        return res.status(400).json({ error: 'Invalid time range' });
    }
    // resolve staff name for denormalization; prefer resolved staff name when staff id supplied
    let staffName = providedName || ''
    let staffId = staff || undefined
    if (staffId) {
        try {
            const st = await req.db(Staff).findOne({ _id: staffId, })
            if (st) staffName = st.name
        } catch (e) {
            // ignore resolution error; keep providedName if any
        }
    }

    // Ensure ward belongs to tenant when tenant context exists
    if (req.tenant) {
        const w = await req.db(Ward).findOne({ _id: ward, });
        if (!w) return res.status(400).json({ error: 'Ward not found for tenant' });
    }

    const shift = req.db(Shift)._wrap({ ward, staff: staffId, staffName, startTime: start, endTime: end, });
    console.log('Creating shift -> staff id:', staffId, 'staffName:', staffName)
    const createdShift = await shift.save();
    console.log('Created shift id:', createdShift._id, 'stored staffName:', createdShift.staffName)
    // return the populated shift so frontend gets the staff name immediately
    // Re-fetch the created document and populate references. Do not assume tenantId filter will always match
    // (especially when older records existed); fall back to the created document if lookup fails.
    let populated = null
    try {
        populated = await req.db(Shift).findById(createdShift._id).populate('ward', 'name').populate('staff', 'name')
    } catch (e) { populated = null }
    const base = (populated && populated.toObject) ? populated.toObject() : createdShift.toObject()
    const out = {
        ...base,
        staffName: (populated && populated.staff && populated.staff.name) ? populated.staff.name : (createdShift.staffName || base.staffName || ''),
    }
    res.status(201).json(out);
});

// @desc    Update a shift
// @route   PUT /api/shifts/:id
// @access  Private/Admin
router.put('/:id', protect, allowAdminOrFeature('manage_shifts'), loadTenant, async (req, res) => {
    try {
        const q = { _id: req.params.id };
        if (req.tenant) q.tenantId = req.tenant._id;
        const shift = await req.db(Shift).findOne(q);
        if (!shift) return res.status(404).json({ error: 'Shift not found' });

        const { ward, staff, startTime, endTime, staffName, handoverNote } = req.body;
        if (ward) shift.ward = ward;
        if (staff) shift.staff = staff;
        if (staffName) shift.staffName = staffName;
        if (startTime) shift.startTime = new Date(startTime);
        if (endTime) shift.endTime = new Date(endTime);
        if (typeof handoverNote === 'string') shift.handoverNote = handoverNote;

        const updated = await shift.save();
        const populated = await req.db(Shift).findById(updated._id).populate('ward', 'name').populate('staff', 'name');
        res.json(populated);
    } catch (e) {
        console.error('[shifts] update error', e);
        res.status(500).json({ error: 'Failed to update shift' });
    }
});

// @desc    Delete a shift
// @route   DELETE /api/shifts/:id
// @access  Private/Admin
router.delete('/:id', protect, allowAdminOrFeature('manage_shifts'), loadTenant, async (req, res) => {
    try {
        const q = { _id: req.params.id };
        if (req.tenant) q.tenantId = req.tenant._id;
        const shift = await req.db(Shift).findOne(q);
        if (!shift) return res.status(404).json({ error: 'Shift not found' });

        await shift.deleteOne();
        res.json({ message: 'Shift deleted' });
    } catch (e) {
        console.error('[shifts] delete error', e);
        res.status(500).json({ error: 'Failed to delete shift' });
    }
});

export default router;
