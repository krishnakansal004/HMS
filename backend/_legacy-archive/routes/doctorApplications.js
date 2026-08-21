import express from 'express';
import bcrypt from 'bcryptjs';
import DoctorApplication from '../models/DoctorApplication.js';
import User from '../models/User.js';
import DoctorProfile from '../models/DoctorProfile.js';
import crypto from 'crypto';
import Tenant from '../models/Tenant.js';
import { enforcePlanLimit } from '../utils/saas.js';
import { sendEmail } from '../utils/notify.js';
import { doctorApprovalTemplate } from '../utils/emailTemplates.js';
import { buildPublicFrontendUrl } from '../utils/publicUrl.js';

const router = express.Router();

// List all applications
router.get('/', async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const role = req.user.role;
    if (!['admin', 'director', 'subadmin'].includes(role)) return res.status(403).json({ error: 'Forbidden' });
    const query = {};
    if (role !== 'director' && req.tenant) {
      query.tenantId = req.tenant._id;
    }
    console.log('[doctorApplications] listing with query:', query);
    const apps = await DoctorApplication.find(query).sort({ createdAt: -1 });
    console.log('[doctorApplications] found:', apps.length);
    res.json(apps);
  } catch (err) {
    console.error('[doctorApplications] list error:', err);
    res.status(500).json({ error: err.message || 'Failed to list applications' });
  }
});

// Approve an application: create doctor user + profile, email credentials
router.post('/:id/approve', enforcePlanLimit('doctors'), async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const role = req.user.role;
    if (!['admin', 'director', 'subadmin'].includes(role)) return res.status(403).json({ error: 'Forbidden' });

    console.log('[doctorApplications] approve request for id:', req.params.id, 'by role:', role);

    const app = await DoctorApplication.findById(req.params.id);
    if (!app) return res.status(404).json({ error: 'Application not found' });
    if (app.status !== 'pending') return res.status(400).json({ error: 'Application already processed' });

    // Security check: ensure admin is acting on application for their own tenant
    if (role !== 'director' && req.tenant && app.tenantId && String(app.tenantId) !== String(req.tenant._id)) {
      return res.status(403).json({ error: 'Application belongs to another hospital' });
    }

    const existing = await User.findOne({ email: app.email });
    if (existing) return res.status(409).json({ error: 'User with email already exists' });

    // Generate setup link token
    const setupToken = crypto.randomBytes(32).toString('hex');
    const hashedSetupToken = crypto.createHash('sha256').update(setupToken).digest('hex');

    // Create user with randomized placeholder password
    const randomPlaceholderPass = crypto.randomBytes(16).toString('hex');
    const passwordHash = await bcrypt.hash(randomPlaceholderPass, 10);
    const tenantId = req.tenant ? req.tenant._id : app.tenantId;

    const user = await User.create({
      name: app.name,
      email: app.email,
      username: app.email,
      phone: app.phone,
      passwordHash,
      role: 'doctor',
      tenantId,
      createdBy: req.userId,
      passwordResetToken: hashedSetupToken,
      passwordResetExpires: new Date(Date.now() + 24 * 60 * 60 * 1000)
    });
    console.log('[doctorApplications] created user:', user._id);

    await DoctorProfile.create({
      user: user._id,
      tenantId,
      designation: 'Dr.',
      specialization: app.specialization || '',
      department: app.department || '',
      experienceYears: app.yearsExperience || 0,
      qualifications: app.education || ''
    });

    app.status = 'approved';
    await app.save();
    console.log('[doctorApplications] application marked approved');

    // Send welcome email — non-fatal if it fails
    if (app.email) {
      try {
        let targetTenant = req.tenant;
        if (!targetTenant && app.tenantId) {
          targetTenant = await Tenant.findById(app.tenantId);
        }
        const companyName = targetTenant ? targetTenant.name : process.env.COMPANY_NAME || 'HMS';
        const subject = `${companyName}: Doctor Account Approved`;
        const base = buildPublicFrontendUrl('');
        const setupUrl = `${base}/reset-password?token=${setupToken}&email=${encodeURIComponent(app.email)}`;
        const { html, attachments } = doctorApprovalTemplate(app, { setupUrl }, targetTenant);
        await sendEmail(app.email, subject, html, attachments?.length ? { attachments } : undefined);
      } catch (emailErr) {
        console.warn('[doctorApplications] approval email failed (non-fatal):', emailErr?.message || emailErr);
      }
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('[doctorApplications] approve error:', err);
    res.status(500).json({ error: err.message || 'Failed to approve application' });
  }
});

// Reject an application
router.post('/:id/reject', async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const role = req.user.role;
    if (!['admin', 'director', 'subadmin'].includes(role)) return res.status(403).json({ error: 'Forbidden' });

    const app = await DoctorApplication.findById(req.params.id);
    if (!app) return res.status(404).json({ error: 'Application not found' });
    if (app.status !== 'pending') return res.status(400).json({ error: 'Application already processed' });
    app.status = 'rejected';
    await app.save();
    res.json({ ok: true });
  } catch (err) {
    console.error('[doctorApplications] reject error:', err);
    res.status(500).json({ error: err.message || 'Failed to reject application' });
  }
});

export default router;
