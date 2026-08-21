import express from 'express';
import Staff from '../models/Staff.js';
import { protect, admin } from '../utils/auth.js';
import { loadTenant, enforcePlanLimit } from '../utils/saas.js';
import { allowRolesWithSubadminFeature } from '../utils/permissions.js';

const router = express.Router();

// @desc    Get all staff
// @route   GET /api/staff
// @access  Private/Admin
router.get('/', protect, loadTenant, allowRolesWithSubadminFeature(['admin','director','subadmin'], 'view_staff'), async (req, res) => {
    const q = {}
    if (req.tenant) q.tenantId = req.tenant._id
    const limit = Number(req.query.limit) || 100
    const page = Number(req.query.page) || 1
    const skip = (page - 1) * limit

    const query = req.db(Staff).find(q)
    if (req.query.limit !== 'all') {
        query.limit(limit).skip(skip)
    }
    const staff = await query;
    res.json(staff);
});

// @desc    Get staff by ID
// @route   GET /api/staff/:id
// @access  Private/Admin
router.get('/:id', protect, loadTenant, allowRolesWithSubadminFeature(['admin','director','subadmin'], 'view_staff'), async (req, res) => {
    const q = { _id: req.params.id }
    if (req.tenant) q.tenantId = req.tenant._id
    const staff = await req.db(Staff).findOne(q);

    if (staff) {
        res.json(staff);
    } else {
        res.status(404);
        throw new Error('Staff not found');
    }
});

// enforce staff/doctor limit per-plan
router.post('/', protect, loadTenant, allowRolesWithSubadminFeature(['admin','director','subadmin'], 'manage_staff'), (req, res, next) => {
    // Dynamically choose limit key: if role is doctor, check doctors limit; else check staff limit.
    const limitKey = (req.body.role === 'doctor') ? 'doctors' : 'staff';
    return enforcePlanLimit(limitKey)(req, res, next);
}, async (req, res) => {
    const { name, role, department, schedule, phone, email, address, weeklySchedule, qualification, specialization, licenseNumber, experienceYears } = req.body;

    const tenantId = req.tenant ? req.tenant._id : (req.user ? req.user.tenantId : undefined)
    const staffExists = tenantId ? await req.db(Staff).findOne({ email, tenantId }) : await req.db(Staff).findOne({ email });

    if (staffExists) {
        res.status(400);
        throw new Error('Staff already exists');
    }

    const staff = await req.db(Staff).create({
        tenantId,
        name,
        role,
        department,
        schedule,
        weeklySchedule,
        phone,
        email,
        address,
        qualification,
        specialization,
        licenseNumber,
        experienceYears
    });

    if (staff) {
        res.status(201).json(staff);
    } else {
        res.status(400);
        throw new Error('Invalid staff data');
    }
});

// @desc    Update a staff member
// @route   PUT /api/staff/:id
// @access  Private/Admin
router.put('/:id', protect, loadTenant, allowRolesWithSubadminFeature(['admin','director','subadmin'], 'manage_staff'), async (req, res) => {
    const staff = await req.db(Staff).findById(req.params.id);

    if (staff) {
        staff.name = req.body.name || staff.name;
        staff.role = req.body.role || staff.role;
        staff.department = req.body.department || staff.department;
        staff.schedule = req.body.schedule || staff.schedule;
        staff.phone = req.body.phone || staff.phone;
        staff.email = req.body.email || staff.email;
        staff.address = req.body.address || staff.address;
        staff.active = req.body.active !== undefined ? req.body.active : staff.active;
        if (req.body.qualification !== undefined) staff.qualification = req.body.qualification;
        if (req.body.specialization !== undefined) staff.specialization = req.body.specialization;
        if (req.body.licenseNumber !== undefined) staff.licenseNumber = req.body.licenseNumber;
        if (req.body.experienceYears !== undefined) staff.experienceYears = req.body.experienceYears;
        if (req.body.weeklySchedule) {
            staff.weeklySchedule = { ...staff.weeklySchedule.toObject?.() || staff.weeklySchedule, ...req.body.weeklySchedule };
        }

        const updatedStaff = await staff.save();
        res.json(updatedStaff);
    } else {
        res.status(404);
        throw new Error('Staff not found');
    }
});

// @desc    Delete a staff member
// @route   DELETE /api/staff/:id
// @access  Private/Admin
router.delete('/:id', protect, loadTenant, allowRolesWithSubadminFeature(['admin','director','subadmin'], 'manage_staff'), async (req, res) => {
    const staff = await req.db(Staff).findById(req.params.id);

    if (staff) {
        await req.db(Staff).delete(staff._id);
        res.json({ message: 'Staff removed' });
    } else {
        res.status(404);
        throw new Error('Staff not found');
    }
});

export default router;
