import express from 'express';
import User from '../models/User.js';
import DoctorProfile from '../models/DoctorProfile.js'
import DoctorApplication from '../models/DoctorApplication.js';
import Query from '../models/Query.js';
import { sendEmail } from '../utils/notify.js';
import { doctorApplicationReceivedTemplate, queryReceivedTemplate } from '../utils/emailTemplates.js';
import tenantMiddleware from '../utils/tenant.js'
import { body, validationResult } from 'express-validator'

const router = express.Router();

// Public: list active doctors (limited fields)
router.get('/doctors', tenantMiddleware, async (req, res) => {
  try {
    let tenant = req.tenant
    // Fallback: identify tenant by slug query param (for public/unauthenticated access)
    if (!tenant && req.query.slug) {
      const Tenant = (await import('../models/Tenant.js')).default
      tenant = await Tenant.findOne({ slug: req.query.slug.trim() })
    }
    if (!tenant) return res.json([])
    const users = await User.find({ role: 'doctor', tenantId: tenant._id }, 'name email phone');
    const profiles = await req.db(DoctorProfile).find({ user: { $in: users.map(u => u._id) } }, 'user designation specialization department experienceYears consultationFee education qualifications');
    const profByUser = new Map(profiles.map(p => [String(p.user), p]));
    const out = users.map(u => {
      const p = profByUser.get(String(u._id));
      return {
        id: u._id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        designation: p?.designation || 'Dr.',
        specialty: p?.specialization || p?.department || 'General Physician',
        specialization: p?.specialization || '',
        department: p?.department || '',
        experienceYears: p?.experienceYears || 0,
        consultationFee: p?.consultationFee || 0,
        education: p?.education || p?.qualifications || '',
      };
    });
    res.json(out);
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Server error' })
  }
});

// Public: get tenant basic info by slug
router.get('/tenant/:slug', async (req, res) => {
  try {
    const { slug } = req.params
    if (!slug) return res.status(400).json({ error: 'Slug required' })
    // Import Tenant dynamically if not imported at top or assume it's imported
    const Tenant = (await import('../models/Tenant.js')).default
    const tenant = await Tenant.findOne({ slug }).select('name _id plan publicProfile')
    if (!tenant) return res.status(404).json({ error: 'Hospital not found' })
    res.json({ id: tenant._id, name: tenant.name, plan: tenant.plan, publicProfile: tenant.publicProfile })
  } catch (e) {
    console.error('[public] get tenant error', e)
    res.status(500).json({ error: 'Server error' })
  }
})

// Public: get all active hospitals for doctor application dropdown
router.get('/hospitals', async (req, res) => {
  try {
    const Tenant = (await import('../models/Tenant.js')).default
    const tenants = await Tenant.find({})
    // Filter active tenants and return only essential data
    const activeTenants = tenants
      .filter(t => t.status === 'active')
      .map(t => ({ id: t._id, name: t.name, slug: t.slug }))
    res.json(activeTenants)
  } catch (e) {
    console.error('[public] get hospitals error', e)
    res.status(500).json({ error: 'Server error' })
  }
})

// Public: submit doctor application
router.post('/doctor-apply', [
  body('name').trim().notEmpty().escape().withMessage('Name is required'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('phone').trim().escape().optional(),
  body('specialization').trim().escape().notEmpty().withMessage('Specialization is required'),
  body('department').trim().escape().optional(),
  body('education').trim().escape().optional(),
  body('yearsExperience').trim().escape().optional(),
  body('address').trim().escape().optional(),
  body('message').trim().escape().optional(),
  body('tenantId').trim().escape().notEmpty().withMessage('Hospital ID is required')
], async (req, res) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg })

  const { name, email, phone, specialization, department, education, yearsExperience, address, message, tenantId } = req.body;

  // Optional: validate tenantId if provided
  let validTenantId = tenantId
  if (tenantId) {
    const Tenant = (await import('../models/Tenant.js')).default
    const t = await Tenant.findById(tenantId)
    if (!t) return res.status(400).json({ error: 'Invalid hospital selected' })
    validTenantId = t._id
  }

  const query = { email, status: 'pending' }
  if (validTenantId) query.tenantId = validTenantId

  const exists = await DoctorApplication.findOne(query);
  if (exists) return res.status(409).json({ error: 'Application already pending' });

  const payload = {
    name, email, phone, specialization, department,
    education, yearsExperience, address, message,
    status: 'pending'
  }
  if (validTenantId) payload.tenantId = validTenantId

  const app = await DoctorApplication.create(payload);

  // Send receipt email (non-blocking best effort)
  if (email) {
    try {
      const subject = `${process.env.COMPANY_NAME || 'PharmaPlus HMS'}: Doctor Application Received`;
      const { html, attachments } = doctorApplicationReceivedTemplate(app);
      await sendEmail(email, subject, html, attachments?.length ? { attachments } : undefined);
    } catch (e) {
      console.warn('doctor application receipt email failed:', e?.message || e);
    }
  }

  res.status(201).json(app);
});

// Public: submit contact query
router.post('/contact', [
  body('name').trim().notEmpty().escape().withMessage('Name is required'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('phone').trim().escape().optional(),
  body('message').trim().escape().notEmpty().withMessage('Message is required')
], async (req, res) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg })

  const { name, email, phone, message } = req.body || {};
  const q = await Query.create({ name, email, phone, message });
  // fire-and-forget email receipt
  if (email) {
    try {
      const { html, attachments } = queryReceivedTemplate(q);
      await sendEmail(email, `${process.env.COMPANY_NAME || 'PharmaPlus HMS'}: Query Received`, html, attachments?.length ? { attachments } : undefined);
    } catch (e) {
      console.warn('query receipt email failed:', e?.message || e);
    }
  }
  res.status(201).json(q);
});

export default router;
