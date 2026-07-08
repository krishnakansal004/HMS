import express from 'express'
import bcrypt from 'bcryptjs'
import User from '../models/User.js'
import DoctorProfile from '../models/DoctorProfile.js'
import QueueToken from '../models/QueueToken.js'
import Prescription from '../models/Prescription.js'
import Invoice from '../models/Invoice.js'
import Appointment from '../models/Appointment.js'
import DoctorAvailability from '../models/DoctorAvailability.js'
import DoctorAttendance from '../models/DoctorAttendance.js'
import LeaveRequest from '../models/LeaveRequest.js'
import PaymentRequest from '../models/PaymentRequest.js'
import { istDateString } from '../utils/ist.js'
import { sendEmail } from '../utils/notify.js'
import { protect, doctor as requireDoctor, admin as requireAdmin, requireRoles } from '../utils/auth.js'
import { loadTenant, enforcePlanLimit } from '../utils/saas.js'
import { allowRolesWithSubadminFeature } from '../utils/permissions.js'
import { getCache, setCache } from '../utils/redis.js'

const router = express.Router()

function toOutput(user, profile) {
  return {
    id: user._id,
    _id: user._id, // for frontend compatibility
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    // presence info
    isOnline: user.isOnline || false,
    lastSeen: user.lastSeen || null,
    designation: profile?.designation || 'Dr.',
    specialization: profile?.specialization || '',
    department: profile?.department || '',
    experienceYears: profile?.experienceYears || 0,
    qualifications: profile?.qualifications || '',
    registrationNumber: profile?.registrationNumber || '',
    consultationFee: profile?.consultationFee || 0,
    weeklySchedule: profile?.weeklySchedule || { mon: '', tue: '', wed: '', thu: '', fri: '', sat: '', sun: '' },
    active: profile?.active ?? true,
    createdAt: profile?.createdAt || user.createdAt,
  }
}

// List all doctors with profile (tenant-scoped)
router.get('/', protect, loadTenant, async (req, res) => {
  try {
    // Basic allowed roles for this endpoint
    const allowed = ['director', 'admin', 'subadmin', 'doctor', 'patient']
    const role = req.user && req.user.role
    if (!role || !allowed.includes(role)) {
      // Log contextual info to help debug unexpected 403s
      try {
        console.warn('[doctors.GET] Forbidden - role check failed', {
          userId: req.userId,
          role: req.user && req.user.role,
          userFeatures: req.user && req.user.features,
          tenantId: req.tenant && req.tenant._id
        })
      } catch (e) { /* noop */ }
      const resp = { error: 'Forbidden' }
      if (process.env.PERM_DEBUG === 'true') {
        resp.details = {
          requiredRoles: allowed,
          userRole: req.user && req.user.role,
          userFeatures: req.user && req.user.features,
          tenantId: req.tenant && String(req.tenant._id),
          userId: req.userId
        }
      }
      return res.status(403).json(resp)
    }

    const tenantId = req.tenant ? req.tenant._id : (req.user ? req.user.tenantId : undefined)
    const limit = Number(req.query.limit) || 100
    const page = Number(req.query.page) || 1
    const all = req.query.all === 'true'

    const cacheKey = `hms:doctors:list:${tenantId}:${role}:${page}:${limit}:${all}`
    const cached = await getCache(cacheKey)
    if (cached) {
      return res.json(cached)
    }

    // Build a role-aware query to limit exposure:
    // - director: sees all doctors in tenant
    // - admin/subadmin: sees doctors they (the admin/subadmin) created
    // - doctor: sees doctors created by the same admin who created this doctor (doc.createdBy), plus self
    const query = { role: 'doctor' }
    if (tenantId) query.tenantId = tenantId

    if (role === 'admin' || role === 'subadmin') {
      // Admins/subadmins only see the doctors they created
      query.createdBy = req.userId
    } else if (role === 'doctor') {
      // For doctors, restrict to doctors created by the same admin who created this doctor.
      try {
        const docUser = await User.findById(req.userId).select('createdBy')
        if (docUser && docUser.createdBy) {
          query.createdBy = docUser.createdBy
          // also ensure the requesting doctor themself is included even if their createdBy is missing
          // we'll fetch by createdBy and then include self in the final output if needed
        } else {
          // if the doctor has no createdBy (provisioned by tenant owner), fall back to tenant-wide list
        }
      } catch (e) {
        // ignore and fall back to tenant scope
      }
    }

    // If the requester is a patient, scope the visible doctors to the creator
    // - If patient was created by an admin/subadmin/director: show doctors created by that admin
    // - If patient was created by a doctor: show only that doctor
    // If user is patient, we generally allow seeing all doctors in the tenant (filtered by tenantId above).
    // No extra restricting by 'createdBy' needed unless specific privacy requirement exists.


    const skip = (page - 1) * limit

    const usersQuery = User.find(query)
    if (req.query.limit !== 'all') {
      usersQuery.limit(limit).skip(skip)
    }
    const users = await usersQuery
    const profiles = await req.db(DoctorProfile).find({ user: { $in: users.map(u => u._id) } })
    const profByUser = new Map(profiles.map(p => [String(p.user), p]))
    let out = users.map(u => toOutput(u, profByUser.get(String(u._id))))

    // Filter by active flag by default for all roles (unless 'all' requested)
    if (req.query.all !== 'true') {
      out = out.filter(o => o.active !== false)
    }

    // If the requester is a doctor and we restricted by createdBy but their own user wasn't included, add them
    if (role === 'doctor') {
      const includedIds = new Set(out.map(o => String(o.id)))
      if (!includedIds.has(String(req.userId))) {
        const self = await User.findById(req.userId)
        if (self && self.role === 'doctor') {
          const selfProfile = await req.db(DoctorProfile).findOne({ user: self._id })
          out.push(toOutput(self, selfProfile))
        }
      }
    }

    // If the requester is a patient, scope the visible doctors to the creator
    // - If patient was created by an admin/subadmin/director: show doctors created by that admin
    // - If patient was created by a doctor: show only that doctor
    // Patient view customization (remove sensitive fields)
    if (role === 'patient') {
      // Filter out any sensitive fields for patients and prefer active doctors
      out = out.map(o => ({ id: o.id, _id: o.id, name: o.name, designation: o.designation, specialization: o.specialization, department: o.department, experienceYears: o.experienceYears, consultationFee: o.consultationFee, isOnline: o.isOnline, email: o.email }))
    }

    await setCache(cacheKey, out, 30).catch(() => {})
    res.json(out)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Server error' })
  }
})

// Create a doctor (User + Profile) - tenant-scoped, enforce plan limits
router.post('/', protect, loadTenant, allowRolesWithSubadminFeature(['director', 'admin', 'subadmin'], 'manage_doctors'), enforcePlanLimit('doctors'), async (req, res) => {
  try {
    let { name, email, phone, password, designation = 'Dr.', specialization, department, experienceYears, qualifications, registrationNumber, consultationFee, address } = req.body
    if (!name || !email || !specialization || !department) {
      console.warn('[doctors.POST] Validation failed - missing fields', { name: !!name, email: !!email, specialization: !!specialization, department: !!department })
      return res.status(400).json({ error: 'Missing required fields' })
    }

    // Auto-generate password if not provided
    if (!password) {
      password = (Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8)).substring(0, 12)
    }

    const tenantId = req.tenant ? req.tenant._id : (req.user ? req.user.tenantId : undefined)
    const exists = await User.findOne({ email, tenantId })
    if (exists) return res.status(409).json({ error: 'Email already in use in this hospital' })
    const passwordHash = await bcrypt.hash(password, 10)
    // assign tenantId from loaded tenant when available
    const user = await User.create({ name, email, phone, passwordHash, role: 'doctor', tenantId, createdBy: req.userId })
    const profile = await req.db(DoctorProfile).create({ user: user._id, designation, specialization, department, experienceYears, qualifications, registrationNumber, consultationFee, address })
    // Notify doctor via email with credentials
    const company = process.env.COMPANY_NAME || 'HMS'
    const subject = `${company}: Doctor Account Created`
    const html = `<p>Dear Dr. ${name},</p>
    <p>You have been added as a doctor in ${company}. You can log in with:</p>
    <p>Email: <strong>${email}</strong><br/>Temporary Password: <strong>${password}</strong></p>
    <p>Please change your password after first login.</p>`
    if (email) {
      try { await sendEmail(email, subject, html) } catch (e) { console.warn('Email send failed', e?.message) }
    }
    res.status(201).json(toOutput(user, profile))
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Server error' })
  }
})

// Update doctor profile (and basic user info)
router.put('/:id', protect, loadTenant, allowRolesWithSubadminFeature(['director', 'admin', 'subadmin'], 'manage_doctors'), async (req, res) => {
  try {
    const id = req.params.id
    const tenantId = req.tenant ? req.tenant._id : (req.user ? req.user.tenantId : undefined)
    const { name, email, phone, designation, specialization, department, experienceYears, qualifications, registrationNumber, consultationFee, active, weeklySchedule } = req.body

    // Update User
    const query = { _id: id, role: 'doctor' }
    if (req.user.role !== 'director' && tenantId) query.tenantId = tenantId
    const user = await User.findOne(query)
    if (!user) return res.status(404).json({ error: 'Not found' })
    await User.update(user._id, { name, email, phone })
    user.name = name; user.email = email; user.phone = phone; // temp update for response

    // Update or Create DoctorProfile
    let profile = await req.db(DoctorProfile).findOne({ user: id })
    const profileData = { designation, specialization, department, experienceYears, qualifications, registrationNumber, consultationFee, active, ...(weeklySchedule ? { weeklySchedule } : {}) }
    if (profile) {
      profile = await req.db(DoctorProfile).update(profile._id, profileData)
    } else {
      profile = await req.db(DoctorProfile).create({ user: id, ...profileData })
    }

    res.json(toOutput(user, profile))
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Server error' })
  }
})

// Delete doctor
// By default the endpoint performs a soft-deactivate (marks profile active=false).
// Pass `?hard=true` to perform a cascading hard delete of user, profile and related documents.
router.delete('/:id', protect, loadTenant, allowRolesWithSubadminFeature(['director', 'admin', 'subadmin'], 'manage_doctors'), async (req, res) => {
  try {
    const id = req.params.id
    const tenantId = req.tenant ? req.tenant._id : (req.user ? req.user.tenantId : undefined)
    const query = { _id: id, role: 'doctor' }
    if (req.user.role !== 'director' && tenantId) query.tenantId = tenantId
    const user = await User.findOne(query)
    if (!user) return res.status(404).json({ error: 'Not found' })

    const hard = String(req.query.hard || '').toLowerCase() === 'true'
    if (!hard) {
      // soft-deactivate
      const p = await req.db(DoctorProfile).findOne({ user: id })
      if (p) await req.db(DoctorProfile).update(p._id, { active: false })
      return res.json({ ok: true, soft: true })
    }

    // Hard delete: cascade-clean related resources where it makes sense
    // Remove doctor-specific documents and references (non-exhaustive but covers main collections)
    await req.db(DoctorProfile).deleteMany({ user: id })
    await req.db(QueueToken).deleteMany({ doctor: id })
    await req.db(Prescription).deleteMany({ doctor: id })
    await req.db(Invoice).deleteMany({ doctor: id })

    // Note: 'doctor.id' nested field queries may not work well with the wrapper
    // We will attempt to use it, but if it fails it's due to the simple where() fallback
    try {
      await PaymentRequest.deleteMany({ 'doctor.id': id })
    } catch (e) {
      console.warn('Could not delete PaymentRequests by nested field', e.message)
    }

    await req.db(DoctorAvailability).deleteMany({ doctor: id })
    await req.db(DoctorAttendance).deleteMany({ doctor: id })
    await req.db(LeaveRequest).deleteMany({ doctor: id })

    // For appointments: cancel future/active appointments so patients are not left waiting.
    // We keep the appointment records for audit, but mark them cancelled and leave doctor ref (populates will be empty after user delete).
    const now = new Date()
    // The Firestore Model doesn't natively support updateMany with $gte/$ne like this in the wrapper,
    // so this is a best-effort using whatever method exists locally or it might fail gracefully if caught.
    try {
      await req.db(Appointment).updateMany({ doctor: id, slotStart: { $gte: now }, status: { $ne: 'cancelled' } }, { $set: { status: 'cancelled', cancellationReason: 'Doctor removed' } })
    } catch (e) { }

    // Finally remove the user account
    await User.deleteOne({ _id: id })

    res.json({ ok: true, hard: true })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Server error' })
  }
})

export default router

// Presence endpoint: doctor (or admin) can set online/offline and optionally auto-admit next waiting token
router.put('/:id/presence', protect, async (req, res) => {
  try {
    const id = req.params.id
    // only the doctor themself or admin can set presence
    if (String(req.userId) !== String(id) && req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' })
    const { online, autoAdmit, meetingLink } = req.body
    const user = await User.findById(id)
    if (!user) return res.status(404).json({ error: 'Doctor not found' })
    user.isOnline = !!online
    user.lastSeen = online ? new Date() : user.lastSeen
    await user.save()

    let admitted = null
    if (online && autoAdmit) {
      // call next waiting token for today
      const today = istDateString()
      const next = await req.db(QueueToken).findOne({ doctor: id, date: today, status: 'waiting' }).sort({ number: 1 })
      if (next) {
        next.status = 'called'
        if (meetingLink) next.meetingLink = meetingLink
        await next.save()
        admitted = await req.db(QueueToken).findById(next._id).populate({ path: 'patient', select: 'firstName lastName phone email' })
      }
    }
    res.json({ ok: true, isOnline: user.isOnline, lastSeen: user.lastSeen, admitted })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Server error' })
  }
})
