import express from 'express';
import InsuranceCompany from '../models/InsuranceCompany.js';
import InsuranceClaim from '../models/InsuranceClaim.js';
import Patient from '../models/Patient.js';
import { protect } from '../utils/auth.js';
import { loadTenant } from '../utils/saas.js';
import { allowRolesWithSubadminFeature } from '../utils/permissions.js';
import { logActivity } from '../utils/auditHelper.js';

const router = express.Router();

// ─── INSURANCE COMPANY / TPA REGISTRY ───────────────────────────────────

// @desc    Get all TPA/Insurance companies
// @route   GET /api/insurance/companies
router.get('/companies', protect, loadTenant, async (req, res) => {
    try {
        const companies = await req.db(InsuranceCompany).find({});
        res.json(companies);
    } catch (e) {
        res.status(500).json({ error: 'Failed to load insurance companies' });
    }
});

// @desc    Add an insurance company / TPA
// @route   POST /api/insurance/companies
router.post('/companies', protect, loadTenant, allowRolesWithSubadminFeature(['admin', 'subadmin'], 'manage_insurance'), async (req, res) => {
    try {
        const { name, code, contactPerson, email, phone, corporateDiscount, status } = req.body;
        const tenantId = req.tenant?._id || req.user?.tenantId;

        const company = await req.db(InsuranceCompany).create({
            tenantId,
            name,
            code,
            contactPerson,
            email,
            phone,
            corporateDiscount: Number(corporateDiscount || 0),
            status: status || 'active',
            createdBy: req.userId
        });

        await logActivity(req, 'CREATE_INSURANCE_COMPANY', 'insurancecompany', company._id, { name, code });
        res.status(201).json(company);
    } catch (e) {
        res.status(500).json({ error: 'Failed to register insurance provider' });
    }
});

// @desc    Update insurance company TPA details
// @route   PUT /api/insurance/companies/:id
router.put('/companies/:id', protect, loadTenant, allowRolesWithSubadminFeature(['admin', 'subadmin'], 'manage_insurance'), async (req, res) => {
    try {
        const company = await req.db(InsuranceCompany).findById(req.params.id);
        if (!company) return res.status(404).json({ error: 'Insurance provider not found' });

        company.name = req.body.name || company.name;
        company.code = req.body.code || company.code;
        company.contactPerson = req.body.contactPerson || company.contactPerson;
        company.email = req.body.email || company.email;
        company.phone = req.body.phone || company.phone;
        company.corporateDiscount = req.body.corporateDiscount !== undefined ? Number(req.body.corporateDiscount) : company.corporateDiscount;
        company.status = req.body.status || company.status;

        const updated = await company.save();
        await logActivity(req, 'UPDATE_INSURANCE_COMPANY', 'insurancecompany', company._id);
        res.json(updated);
    } catch (e) {
        res.status(500).json({ error: 'Failed to update insurance provider' });
    }
});

// @desc    Delete insurance company
// @route   DELETE /api/insurance/companies/:id
router.delete('/companies/:id', protect, loadTenant, allowRolesWithSubadminFeature(['admin', 'subadmin'], 'manage_insurance'), async (req, res) => {
    try {
        await req.db(InsuranceCompany).deleteOne({ _id: req.params.id });
        await logActivity(req, 'DELETE_INSURANCE_COMPANY', 'insurancecompany', req.params.id);
        res.json({ message: 'Insurance provider removed' });
    } catch (e) {
        res.status(500).json({ error: 'Failed to delete insurance company' });
    }
});


// ─── PATIENT CLAIMS ENDPOINTS ───────────────────────────────────────────

// @desc    Get claims list
// @route   GET /api/insurance/claims
router.get('/claims', protect, loadTenant, async (req, res) => {
    try {
        const q = {};
        if (req.user?.role === 'patient') {
            const patient = await req.db(Patient).findOne({ email: req.user.email });
            if (!patient) return res.json([]);
            q.patient = patient._id;
        }
        const claims = await req.db(InsuranceClaim).find(q).sort({ createdAt: -1 });
        res.json(claims);
    } catch (e) {
        res.status(500).json({ error: 'Failed to retrieve claims' });
    }
});

// @desc    Log a new insurance claim
// @route   POST /api/insurance/claims
router.post('/claims', protect, loadTenant, allowRolesWithSubadminFeature(['admin', 'subadmin'], 'manage_insurance'), async (req, res) => {
    try {
        const { patientId, companyId, policyNumber, totalBillAmount, claimedAmount, invoiceId } = req.body;
        const tenantId = req.tenant?._id || req.user?.tenantId;

        const patient = await req.db(Patient).findById(patientId);
        if (!patient) return res.status(404).json({ error: 'Patient not found' });

        const company = await req.db(InsuranceCompany).findById(companyId);
        if (!company) return res.status(404).json({ error: 'Insurance company not found' });

        const claim = await req.db(InsuranceClaim).create({
            tenantId,
            patient: patientId,
            patientName: `${patient.firstName} ${patient.lastName}`,
            insuranceCompany: companyId,
            insuranceCompanyName: company.name,
            policyNumber,
            totalBillAmount: Number(totalBillAmount || 0),
            claimedAmount: Number(claimedAmount || 0),
            approvedAmount: 0,
            invoice: invoiceId || null,
            status: 'submitted', // submitted -> approved -> rejected -> settled
            createdBy: req.userId
        });

        await logActivity(req, 'SUBMIT_INSURANCE_CLAIM', 'insuranceclaim', claim._id, { patientId, policyNumber });
        res.status(201).json(claim);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Failed to create insurance claim' });
    }
});

// @desc    Review and update claim status / approved amount / settlements
// @route   PUT /api/insurance/claims/:id
router.put('/claims/:id', protect, loadTenant, allowRolesWithSubadminFeature(['admin', 'subadmin'], 'manage_insurance'), async (req, res) => {
    try {
        const { status, approvedAmount, rejectionReason, settlementDate, transactionId } = req.body;
        const claim = await req.db(InsuranceClaim).findById(req.params.id);
        if (!claim) return res.status(404).json({ error: 'Claim record not found' });

        if (status) claim.status = status;
        if (approvedAmount !== undefined) claim.approvedAmount = Number(approvedAmount);
        if (rejectionReason !== undefined) claim.rejectionReason = rejectionReason;
        if (settlementDate) claim.settlementDate = new Date(settlementDate);
        if (transactionId) claim.transactionId = transactionId;

        const updated = await claim.save();
        await logActivity(req, 'UPDATE_INSURANCE_CLAIM', 'insuranceclaim', claim._id, { status, approvedAmount });
        res.json(updated);
    } catch (e) {
        res.status(500).json({ error: 'Failed to update claim record' });
    }
});

export default router;
