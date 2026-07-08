import express from 'express';
import RadiologyOrder from '../models/RadiologyOrder.js';
import Patient from '../models/Patient.js';
import { protect } from '../utils/auth.js';
import { loadTenant } from '../utils/saas.js';
import { allowRolesWithSubadminFeature } from '../utils/permissions.js';
import { logActivity } from '../utils/auditHelper.js';
import { postBillingCharge } from '../utils/billingHelper.js';
import { uploadToCloudinary } from '../config/cloudinary.js';
import multer from 'multer';

const router = express.Router();
const storage = multer.memoryStorage();
const upload = multer({ storage });

// @desc    Get all radiology orders
// @route   GET /api/radiology/orders
router.get('/orders', protect, loadTenant, async (req, res) => {
    try {
        const q = {};
        if (req.user?.role === 'patient') {
            const patient = await req.db(Patient).findOne({ email: req.user.email });
            if (!patient) return res.json([]);
            q.patient = patient._id;
        }

        const orders = await req.db(RadiologyOrder).find(q).sort({ createdAt: -1 });
        res.json(orders);
    } catch (e) {
        res.status(500).json({ error: 'Failed to load radiology orders' });
    }
});

// @desc    Create a radiology order
// @route   POST /api/radiology/orders
router.post('/orders', protect, loadTenant, allowRolesWithSubadminFeature(['admin', 'subadmin', 'doctor'], 'manage_radiology'), async (req, res) => {
    try {
        const { patientId, modality, studyType, bodyPart, urgency, price, notes } = req.body;
        const tenantId = req.tenant?._id || req.user?.tenantId;

        const patient = await req.db(Patient).findById(patientId);
        if (!patient) return res.status(404).json({ error: 'Patient not found' });

        const order = await req.db(RadiologyOrder).create({
            tenantId,
            patient: patientId,
            patientName: `${patient.firstName} ${patient.lastName}`,
            modality, // X-RAY, MRI, CT, ULTRASOUND
            studyType, // e.g. Brain MRI with Contrast, Chest X-Ray
            bodyPart,
            urgency: urgency || 'routine',
            price: Number(price || 1500),
            notes: notes || '',
            status: 'pending', // pending -> scheduled -> scanning -> completed -> cancelled
            scanImages: [],
            scanMetadata: {},
            createdBy: req.userId,
            billingStatus: 'pending'
        });

        await logActivity(req, 'CREATE_RADIOLOGY_ORDER', 'radiologyorder', order._id, { patientId, modality });
        res.status(201).json(order);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Failed to create radiology order' });
    }
});

// @desc    Upload scan images (DICOM/Image mock files)
// @route   POST /api/radiology/orders/:id/scans
router.post('/orders/:id/scans', protect, loadTenant, upload.single('scan'), async (req, res) => {
    try {
        const order = await req.db(RadiologyOrder).findById(req.params.id);
        if (!order) return res.status(404).json({ error: 'Radiology order not found' });

        if (!req.file) return res.status(400).json({ error: 'No scan file uploaded' });

        // Upload to Cloudinary
        let imageUrl = '';
        try {
            const uploadRes = await uploadToCloudinary(req.file.buffer, 'radiology', 'image');
            imageUrl = uploadRes.secure_url;
        } catch (uploadErr) {
            console.warn('[radiologyRouter] Upload failed, generating mock image url');
            imageUrl = 'https://images.unsplash.com/photo-1576086213369-97a306d36557?auto=format&fit=crop&q=80&w=600';
        }

        const images = Array.isArray(order.scanImages) ? order.scanImages : [];
        images.push({
            url: imageUrl,
            uploadedAt: new Date(),
            fileName: req.file.originalname,
            size: req.file.size
        });
        
        order.scanImages = images;
        order.status = 'scanning';
        
        const updated = await order.save();
        await logActivity(req, 'UPLOAD_RADIOLOGY_SCAN', 'radiologyorder', order._id, { imageUrl });
        res.json(updated);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Failed to upload scan image' });
    }
});

// @desc    Complete radiology study and post billing charges
// @route   POST /api/radiology/orders/:id/complete
router.post('/orders/:id/complete', protect, loadTenant, allowRolesWithSubadminFeature(['admin', 'subadmin', 'doctor'], 'manage_radiology'), async (req, res) => {
    try {
        const { findings, impression, scanMetadata } = req.body;
        const order = await req.db(RadiologyOrder).findById(req.params.id);
        if (!order) return res.status(404).json({ error: 'Radiology order not found' });

        order.findings = findings || '';
        order.impression = impression || '';
        order.scanMetadata = scanMetadata || { sliceCount: 120, contrastAgent: 'Gadolinium', windowWidth: 400, windowCenter: 40 };
        order.status = 'completed';
        order.completedAt = new Date();
        order.completedBy = req.userId;

        // Post charge to patient invoice
        if (order.price > 0) {
            await postBillingCharge(req, order.patient, `Radiology: ${order.modality} - ${order.studyType}`, order.price);
            order.billingStatus = 'billed';
        }

        const updated = await order.save();
        await logActivity(req, 'COMPLETE_RADIOLOGY_STUDY', 'radiologyorder', order._id);
        res.json(updated);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Failed to complete radiology study' });
    }
});

export default router;
