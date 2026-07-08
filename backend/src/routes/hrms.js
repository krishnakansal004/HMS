import express from 'express';
import StaffPayroll from '../models/StaffPayroll.js';
import StaffPerformance from '../models/StaffPerformance.js';
import Staff from '../models/Staff.js';
import { protect } from '../utils/auth.js';
import { loadTenant } from '../utils/saas.js';
import { allowRolesWithSubadminFeature } from '../utils/permissions.js';
import { logActivity } from '../utils/auditHelper.js';

const router = express.Router();

// ─── PAYROLL MANAGEMENT ──────────────────────────────────────────────────

// @desc    Get all payroll history
// @route   GET /api/hrms/payroll
router.get('/payroll', protect, loadTenant, allowRolesWithSubadminFeature(['admin', 'subadmin'], 'view_staff'), async (req, res) => {
    try {
        const payrolls = await req.db(StaffPayroll).find({}).sort({ payPeriodYear: -1, payPeriodMonth: -1 });
        res.json(payrolls);
    } catch (e) {
        res.status(500).json({ error: 'Failed to load payroll details' });
    }
});

// @desc    Release salary / generate payroll
// @route   POST /api/hrms/payroll
router.post('/payroll', protect, loadTenant, allowRolesWithSubadminFeature(['admin', 'subadmin'], 'manage_staff'), async (req, res) => {
    try {
        const { staffId, month, year, baseSalary, bonuses, deductions, notes } = req.body;
        const tenantId = req.tenant?._id || req.user?.tenantId;

        const employee = await req.db(Staff).findById(staffId);
        if (!employee) return res.status(404).json({ error: 'Employee not found' });

        const base = Number(baseSalary || 0);
        const bonus = Number(bonuses || 0);
        const deduct = Number(deductions || 0);
        const netSalary = base + bonus - deduct;

        const transactionId = 'TXN-PAY-' + Date.now().toString().slice(-6) + Math.floor(Math.random()*100);

        const payroll = await req.db(StaffPayroll).create({
            tenantId,
            staff: staffId,
            staffName: employee.name,
            staffRole: employee.role,
            payPeriodMonth: month, // e.g., 'June'
            payPeriodYear: Number(year), // e.g., 2026
            baseSalary: base,
            bonuses: bonus,
            deductions: deduct,
            netSalary,
            payoutDate: new Date(),
            transactionId,
            notes: notes || '',
            status: 'paid',
            createdBy: req.userId
        });

        await logActivity(req, 'RELEASE_PAYROLL', 'staffpayroll', payroll._id, { staffId, netSalary, payPeriod: `${month} ${year}` });
        res.status(201).json(payroll);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Failed to process payroll release' });
    }
});


// ─── PERFORMANCE MANAGEMENT ──────────────────────────────────────────────

// @desc    Get performance reviews
// @route   GET /api/hrms/performance
router.get('/performance', protect, loadTenant, allowRolesWithSubadminFeature(['admin', 'subadmin'], 'view_staff'), async (req, res) => {
    try {
        const reviews = await req.db(StaffPerformance).find({}).sort({ createdAt: -1 });
        res.json(reviews);
    } catch (e) {
        res.status(500).json({ error: 'Failed to load performance log' });
    }
});

// @desc    Log employee performance review
// @route   POST /api/hrms/performance
router.post('/performance', protect, loadTenant, allowRolesWithSubadminFeature(['admin', 'subadmin'], 'manage_staff'), async (req, res) => {
    try {
        const { staffId, rating, feedback, metrics } = req.body;
        const tenantId = req.tenant?._id || req.user?.tenantId;

        const employee = await req.db(Staff).findById(staffId);
        if (!employee) return res.status(404).json({ error: 'Employee not found' });

        const review = await req.db(StaffPerformance).create({
            tenantId,
            staff: staffId,
            staffName: employee.name,
            rating: Number(rating || 5), // 1 to 5 scale
            feedback: feedback || '',
            metrics: metrics || { punctuality: 5, careQuality: 5, teamCooperation: 5 },
            reviewer: req.userId,
            reviewerName: req.user?.name || 'Administrator',
            status: 'active',
            createdBy: req.userId
        });

        await logActivity(req, 'LOG_STAFF_PERFORMANCE', 'staffperformance', review._id, { staffId, rating });
        res.status(201).json(review);
    } catch (e) {
        res.status(500).json({ error: 'Failed to submit review' });
    }
});

export default router;
