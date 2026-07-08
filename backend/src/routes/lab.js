import express from 'express';
import PDFDocument from 'pdfkit';
import LabTest from '../models/LabTest.js';
import LabOrder from '../models/LabOrder.js';
import Patient from '../models/Patient.js';
import { protect } from '../utils/auth.js';
import { loadTenant } from '../utils/saas.js';
import { allowRolesWithSubadminFeature } from '../utils/permissions.js';
import { logActivity } from '../utils/auditHelper.js';
import { postBillingCharge } from '../utils/billingHelper.js';
import { uploadToCloudinary } from '../config/cloudinary.js';

const router = express.Router();

// ─── LAB TEST MASTER ENDPOINTS ──────────────────────────────────────────

// @desc    Get LIS test master catalog
// @route   GET /api/lab/tests
router.get('/tests', protect, loadTenant, async (req, res) => {
    try {
        const tests = await req.db(LabTest).find({});
        res.json(tests);
    } catch (e) {
        res.status(500).json({ error: 'Failed to load LIS catalog' });
    }
});

// @desc    Create test in LIS master catalog
// @route   POST /api/lab/tests
router.post('/tests', protect, loadTenant, allowRolesWithSubadminFeature(['admin', 'subadmin'], 'manage_lab'), async (req, res) => {
    try {
        const { name, code, category, sampleType, price, referenceRange, parameters } = req.body;
        const tenantId = req.tenant?._id || req.user?.tenantId;
        
        const test = await req.db(LabTest).create({
            tenantId,
            name,
            code,
            category,
            sampleType,
            price: Number(price || 0),
            referenceRange,
            parameters: Array.isArray(parameters) ? parameters : [],
            status: 'active',
            createdBy: req.userId
        });

        await logActivity(req, 'CREATE_LAB_TEST', 'labtest', test._id, { name, code });
        res.status(201).json(test);
    } catch (e) {
        res.status(500).json({ error: 'Failed to create lab test catalog item' });
    }
});

// @desc    Update LIS test in catalog
// @route   PUT /api/lab/tests/:id
router.put('/tests/:id', protect, loadTenant, allowRolesWithSubadminFeature(['admin', 'subadmin'], 'manage_lab'), async (req, res) => {
    try {
        const test = await req.db(LabTest).findById(req.params.id);
        if (!test) return res.status(404).json({ error: 'Lab test not found' });

        test.name = req.body.name || test.name;
        test.code = req.body.code || test.code;
        test.category = req.body.category || test.category;
        test.sampleType = req.body.sampleType || test.sampleType;
        test.price = req.body.price !== undefined ? Number(req.body.price) : test.price;
        test.referenceRange = req.body.referenceRange || test.referenceRange;
        test.parameters = req.body.parameters || test.parameters;
        test.status = req.body.status || test.status;

        const updated = await test.save();
        await logActivity(req, 'UPDATE_LAB_TEST', 'labtest', test._id);
        res.json(updated);
    } catch (e) {
        res.status(500).json({ error: 'Failed to update lab test catalog item' });
    }
});

// @desc    Delete LIS test from catalog
// @route   DELETE /api/lab/tests/:id
router.delete('/tests/:id', protect, loadTenant, allowRolesWithSubadminFeature(['admin', 'subadmin'], 'manage_lab'), async (req, res) => {
    try {
        await req.db(LabTest).deleteOne({ _id: req.params.id });
        await logActivity(req, 'DELETE_LAB_TEST', 'labtest', req.params.id);
        res.json({ message: 'Lab test master deleted' });
    } catch (e) {
        res.status(500).json({ error: 'Failed to delete lab test catalog item' });
    }
});


// ─── LAB ORDER ENDPOINTS ──────────────────────────────────────────────────

// @desc    Get LIS orders (active/history)
// @route   GET /api/lab/orders
router.get('/orders', protect, loadTenant, async (req, res) => {
    try {
        const q = {};
        if (req.user?.role === 'patient') {
            const patient = await req.db(Patient).findOne({ email: req.user.email });
            if (!patient) return res.json([]);
            q.patient = patient._id;
        }

        const orders = await req.db(LabOrder).find(q).sort({ createdAt: -1 });
        res.json(orders);
    } catch (e) {
        res.status(500).json({ error: 'Failed to load LIS orders' });
    }
});

// @desc    Create lab order
// @route   POST /api/lab/orders
router.post('/orders', protect, loadTenant, allowRolesWithSubadminFeature(['admin', 'subadmin', 'doctor'], 'manage_lab'), async (req, res) => {
    try {
        const { patientId, testId, doctorId, notes, prescriptionId } = req.body;
        const tenantId = req.tenant?._id || req.user?.tenantId;

        const patient = await req.db(Patient).findById(patientId);
        if (!patient) return res.status(404).json({ error: 'Patient not found' });

        const testMaster = await req.db(LabTest).findById(testId);
        if (!testMaster) return res.status(404).json({ error: 'Lab test master not found' });

        // Generate barcode ID
        const barcode = 'LAB-' + Date.now().toString().slice(-8) + Math.floor(Math.random() * 10);

        const order = await req.db(LabOrder).create({
            tenantId,
            patient: patientId,
            patientName: `${patient.firstName} ${patient.lastName}`,
            test: testId,
            testName: testMaster.name,
            testCode: testMaster.code,
            doctor: doctorId || req.userId,
            doctorName: req.user?.name || 'Assigned Physician',
            barcode,
            sampleStatus: 'pending', // pending -> collected -> received -> processing -> completed
            trackingStatus: 'Order Created',
            results: testMaster.parameters.map(p => ({
                name: p.name || p,
                value: '',
                unit: p.unit || '',
                referenceRange: p.range || ''
            })),
            notes: notes || '',
            prescription: prescriptionId || null,
            status: 'active',
            billingStatus: 'pending',
            createdBy: req.userId
        });

        await logActivity(req, 'CREATE_LAB_ORDER', 'laborder', order._id, { patientId, testId });
        res.status(201).json(order);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Failed to create lab order' });
    }
});

// @desc    Update lab order status (e.g. sample collected, received)
// @route   PUT /api/lab/orders/:id
router.put('/orders/:id', protect, loadTenant, allowRolesWithSubadminFeature(['admin', 'subadmin', 'doctor', 'staff'], 'manage_lab'), async (req, res) => {
    try {
        const { sampleStatus, trackingStatus } = req.body;
        const order = await req.db(LabOrder).findById(req.params.id);
        if (!order) return res.status(404).json({ error: 'Lab order not found' });

        if (sampleStatus) order.sampleStatus = sampleStatus;
        if (trackingStatus) order.trackingStatus = trackingStatus;

        const updated = await order.save();
        await logActivity(req, 'UPDATE_LAB_ORDER_STATUS', 'laborder', order._id, { sampleStatus, trackingStatus });
        res.json(updated);
    } catch (e) {
        res.status(500).json({ error: 'Failed to update lab order' });
    }
});

// @desc    Submit result entry
// @route   POST /api/lab/orders/:id/results
router.post('/orders/:id/results', protect, loadTenant, allowRolesWithSubadminFeature(['admin', 'subadmin', 'doctor'], 'manage_lab'), async (req, res) => {
    try {
        const { results, technicianNotes } = req.body;
        const order = await req.db(LabOrder).findById(req.params.id);
        if (!order) return res.status(404).json({ error: 'Lab order not found' });

        order.results = results;
        order.technicianNotes = technicianNotes || '';
        order.sampleStatus = 'processing';
        order.trackingStatus = 'Results Drafted';

        const updated = await order.save();
        await logActivity(req, 'SAVE_LAB_RESULTS', 'laborder', order._id);
        res.json(updated);
    } catch (e) {
        res.status(500).json({ error: 'Failed to save results' });
    }
});

// @desc    Verify results and generate PDF
// @route   POST /api/lab/orders/:id/verify
router.post('/orders/:id/verify', protect, loadTenant, allowRolesWithSubadminFeature(['admin', 'subadmin', 'doctor'], 'manage_lab'), async (req, res) => {
    try {
        const order = await req.db(LabOrder).findById(req.params.id);
        if (!order) return res.status(404).json({ error: 'Lab order not found' });

        order.sampleStatus = 'completed';
        order.trackingStatus = 'Verified & Completed';
        order.verifiedBy = req.userId;
        order.verifiedByName = req.user?.name || 'Lab Pathologist';
        order.verifiedAt = new Date();

        // ─── GENERATE PDF REPORT ──────────────────────────────────────────
        const doc = new PDFDocument({ margin: 50 });
        const chunks = [];
        doc.on('data', chunk => chunks.push(chunk));

        // Layout the PDF
        doc.fillColor('#1e3a8a').fontSize(22).text('LABORATORY DIAGNOSTIC REPORT', { align: 'center' });
        doc.moveDown(0.5);
        doc.strokeColor('#e2e8f0').lineWidth(1).moveTo(50, doc.y).lineTo(550, doc.y).stroke();
        doc.moveDown(1);

        doc.fillColor('#0f172a').fontSize(10);
        doc.text(`Patient Name: ${order.patientName}`, 50, 100);
        doc.text(`Order ID: ${order._id}`, 50, 115);
        doc.text(`Barcode: ${order.barcode}`, 50, 130);

        doc.text(`Doctor Name: ${order.doctorName}`, 320, 100);
        doc.text(`Date Sample: ${order.verifiedAt.toLocaleDateString()}`, 320, 115);
        doc.text(`Status: Verified`, 320, 130);
        doc.moveDown(2.5);

        doc.fontSize(12).fillColor('#1e3a8a').text('Test Performed: ' + order.testName);
        doc.moveDown(1);

        // Results Table Header
        doc.fontSize(10).fillColor('#475569');
        doc.text('Parameter Name', 50, 200);
        doc.text('Observed Value', 250, 200);
        doc.text('Unit', 380, 200);
        doc.text('Reference Range', 450, 200);

        doc.strokeColor('#cbd5e1').moveTo(50, 215).lineTo(550, 215).stroke();
        doc.moveDown(1.5);

        // Results Table Rows
        let y = 230;
        doc.fillColor('#0f172a');
        for (const r of order.results) {
            doc.text(r.name, 50, y);
            doc.fillColor('#0284c7').text(r.value || 'N/A', 250, y);
            doc.fillColor('#0f172a').text(r.unit || '-', 380, y);
            doc.text(r.referenceRange || '-', 450, y);
            y += 20;
        }

        doc.moveDown(3);
        doc.fillColor('#475569').fontSize(10).text('Technician Notes: ' + (order.technicianNotes || 'None'));
        doc.moveDown(2);
        doc.fillColor('#0f172a').text('Authorized Signatory:', 350);
        doc.text(order.verifiedByName, 350);

        doc.end();

        // Wait for PDF buffer
        const pdfBuffer = await new Promise((resolve) => {
            doc.on('end', () => resolve(Buffer.concat(chunks)));
        });

        // Upload to Cloudinary or save URL
        let reportUrl = '';
        try {
            const uploadRes = await uploadToCloudinary(pdfBuffer, 'lab-reports', 'raw');
            reportUrl = uploadRes.secure_url;
        } catch (uploadErr) {
            console.warn('[labRouter] Cloudinary upload failed, generating mock URL', uploadErr.message);
            reportUrl = `/uploads/lab-report-${order._id}.pdf`;
        }

        order.reportUrl = reportUrl;

        // ─── BILLING INTEGRATION: Post Charge ────────────────────────────────
        const testMaster = await req.db(LabTest).findById(order.test);
        if (testMaster && testMaster.price > 0) {
            await postBillingCharge(req, order.patient, `LIS Test: ${order.testName}`, testMaster.price);
            order.billingStatus = 'billed';
        }

        const updated = await order.save();
        await logActivity(req, 'VERIFY_LAB_RESULTS', 'laborder', order._id, { reportUrl });
        res.json(updated);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Failed to verify lab order results' });
    }
});

export default router;
