import express from 'express'
import DoctorAvailability from '../models/DoctorAvailability.js'
import User from '../models/User.js'
import { protect } from '../utils/auth.js'
import { loadTenant } from '../utils/saas.js'
import { allowRolesWithSubadminFeature } from '../utils/permissions.js'
import tenantMiddleware from '../utils/tenant.js'

const router = express.Router()

// List doctors
router.get('/doctors', loadTenant, tenantMiddleware, allowRolesWithSubadminFeature(['admin', 'subadmin', 'doctor'], 'view_doctors'), async (req, res) => {
  try {
    const q = { role: 'doctor' }
    if (req.tenant) q.tenantId = req.tenant._id
    const doctors = await User.find(q).select('name email phone role')
    res.json(doctors)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Server error' })
  }
})

// Get weekly availability for a doctor
router.get('/:doctorId', loadTenant, tenantMiddleware, allowRolesWithSubadminFeature(['admin', 'subadmin', 'doctor'], 'view_doctors'), async (req, res) => {
  try {
    const doctorId = req.params.doctorId
    const q = { doctor: doctorId }
    if (req.tenant) q.tenantId = req.tenant._id
    let doc = await req.db(DoctorAvailability).findOne(q)
    if (!doc) doc = await req.db(DoctorAvailability).create({ doctor: doctorId, })
    res.json(doc)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Server error' })
  }
})

// Update weekly availability
router.put('/:doctorId', protect, loadTenant, tenantMiddleware, allowRolesWithSubadminFeature(['admin', 'subadmin', 'doctor'], 'manage_availability'), async (req, res) => {
  try {
    const doctorId = req.params.doctorId
    const { days, exceptions } = req.body
    // Enforce: doctors can only update their own availability; admins can update anyone
    if (req.userRole === 'doctor' && String(req.userId) !== String(doctorId)) {
      return res.status(403).json({ error: 'Forbidden' })
    }
    // ensure doctor belongs to tenant
    if (req.tenant) {
      const docUser = await User.findOne({ _id: doctorId, })
      if (!docUser) return res.status(404).json({ error: 'Doctor not found for tenant' })
    }
    const filter = { doctor: doctorId }
    if (req.tenant) filter.tenantId = req.tenant._id
    const update = { days, exceptions }
    if (req.tenant && req.tenant._id) update.tenantId = req.tenant._id

    let doc = await req.db(DoctorAvailability).findOne(filter)
    if (doc) {
      doc = await req.db(DoctorAvailability).update(doc._id, update)
    } else {
      doc = await req.db(DoctorAvailability).create({ ...filter, ...update })
    }

    res.json(doc)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Server error' })
  }
})

// Simple availability dashboard (who is available now and next slot)
router.get('/', loadTenant, tenantMiddleware, allowRolesWithSubadminFeature(['admin', 'subadmin', 'doctor'], 'view_doctors'), async (req, res) => {
  try {
    const q = {}
    if (req.tenant) q.tenantId = req.tenant._id
    const docs = await req.db(DoctorAvailability).find(q).populate('doctor', 'name email phone role')
    const now = new Date()
    const dow = now.getDay()
    const out = docs.map(d => {
      const day = Array.isArray(d.days) ? d.days.find(x => x.dayOfWeek === dow) : undefined
      const isToday = !!day?.enabled
      return {
        doctor: d.doctor,
        todayEnabled: isToday,
        startTime: day?.startTime,
        endTime: day?.endTime,
        slotDurationMin: day?.slotDurationMin || 15,
      }
    })
    res.json(out)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Server error' })
  }
})

export default router
