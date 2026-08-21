import express from 'express'
import { protect } from '../utils/auth.js'
import tenantMiddleware from '../utils/tenant.js'
import User from '../models/User.js'
import DoctorAttendance from '../models/DoctorAttendance.js'
import { getCache, setCache, delCache } from '../utils/redis.js'
import CacheAttendance from '../models/CacheAttendance.js'

import { allowRolesWithSubadminFeature } from '../utils/permissions.js'
const router = express.Router()

// List doctor attendance (admin/subadmin can filter by doctor/date; doctors see their own)
router.get('/', protect, allowRolesWithSubadminFeature(['admin','director','subadmin','doctor'], 'doctor_attendance'), tenantMiddleware, async (req, res) => {
  try {
    const { date, doctorId } = req.query || {}
    const tenantId = req.tenant?._id || req.tenantId
    const cacheKey = `hms:doctorAttendance:list:${tenantId}:${date || ''}:${doctorId || ''}:${req.userRole}:${req.userId}`

    let cached = await getCache(cacheKey)
    if (!cached) {
      const cacheDoc = await req.db(CacheAttendance).findOne({ type: cacheKey })
      if (cacheDoc && cacheDoc.data) {
        cached = cacheDoc.data
        await setCache(cacheKey, cached, 30).catch(() => {})
      }
    }
    if (cached) {
      return res.json(cached)
    }

    const query = {}
    if (tenantId) query.tenantId = tenantId
    if (date) query.date = date
    if (req.userRole === 'doctor') {
      query.doctor = req.userId
    } else if (doctorId) {
      query.doctor = doctorId
    }

    let list = await req.db(DoctorAttendance).find(query)

    // Build a doctor lookup map for use later
    let doctorMap = new Map()

    // Admin daily board: ensure all doctors appear. Seed missing records as 'unmarked' or 'not-required' for Sundays.
    if (['admin', 'subadmin'].includes(req.userRole) && date && !doctorId) {
      const dateObj = new Date(date)
      const isSunday = dateObj.getDay() === 0
      const doctorQuery = { role: 'doctor' }
      if (tenantId) doctorQuery.tenantId = tenantId
      const doctors = await User.find(doctorQuery)
      
      // Build map for manual population
      doctors.forEach(d => doctorMap.set(String(d._id), { _id: d._id, name: d.name, email: d.email }))

      const existingMap = new Map(list.map(r => [String(r.doctor), r]))
      const seedPromises = doctors
        .filter(d => !existingMap.has(String(d._id)))
        .map(async (d) => {
          try {
            const rec = await req.db(DoctorAttendance).create({
              doctor: String(d._id),
              date,
              status: isSunday ? 'not-required' : 'unmarked',
              ...(tenantId ? { tenantId } : {})
            })
            return rec
          } catch (e) {
            console.warn('[doctor-attendance] skipped duplicate seeding for', d._id)
            return null
          }
        })
      const seeded = await Promise.all(seedPromises)
      const newRecords = seeded.filter(Boolean)
      list = list.concat(newRecords)
    } else if (req.userRole === 'doctor') {
      // For doctor self-view, fetch their own user info
      const docUser = await User.findById(req.userId)
      if (docUser) doctorMap.set(String(docUser._id), { _id: docUser._id, name: docUser.name, email: docUser.email })
    }

    // If doctorMap is empty (admin filtering single doctor or non-seeding path), fetch those doctors
    if (doctorMap.size === 0) {
      const docIds = [...new Set(list.map(r => String(r.doctor)).filter(Boolean))]
      if (docIds.length > 0) {
        const docs = await User.find({ _id: { $in: docIds } })
        docs.forEach(d => doctorMap.set(String(d._id), { _id: d._id, name: d.name, email: d.email }))
      }
    }

    // Manual population of doctor field
    list = list.map(r => {
      const plain = r.toObject ? r.toObject() : { ...r }
      const docInfo = doctorMap.get(String(plain.doctor))
      if (docInfo) plain.doctor = docInfo
      return plain
    })

    // Sort by doctor name after population
    list.sort((a, b) => {
      const aName = typeof a.doctor === 'object' ? (a.doctor?.name || '') : ''
      const bName = typeof b.doctor === 'object' ? (b.doctor?.name || '') : ''
      return aName.localeCompare(bName)
    })

    await setCache(cacheKey, list, 30).catch(() => {})
    await req.db(CacheAttendance).deleteOne({ type: cacheKey }).catch(() => {})
    await req.db(CacheAttendance).create({ type: cacheKey, data: list, tenantId }).catch(() => {})

    res.json(list)
  } catch (err) {
    console.error('[doctor-attendance] error', err)
    res.status(500).json({ error: 'Failed to filter doctor attendance' })
  }
})

// Mark own attendance (doctor) or any doctor's (admin/subadmin). Only once per day.
router.post('/', protect, allowRolesWithSubadminFeature(['admin','director','subadmin','doctor'], 'doctor_attendance'), tenantMiddleware, async (req, res) => {
  const { date, status, notes, checkInAt, checkOutAt, doctorId } = req.body || {}
  if (!date) return res.status(400).json({ error: 'date required (YYYY-MM-DD)' })
  const dateObj = new Date(date)
  if (isNaN(dateObj)) return res.status(400).json({ error: 'invalid date format' })
  const isSunday = dateObj.getDay() === 0
  if (isSunday && req.userRole === 'doctor') {
    return res.status(403).json({ error: 'Attendance not required on Sunday' })
  }
  const targetDoctor = req.userRole === 'doctor' ? req.userId : (doctorId || null)
  if (!targetDoctor) return res.status(400).json({ error: 'doctorId required' })
  if (req.userRole === 'doctor' && doctorId && String(doctorId) !== String(req.userId)) {
    return res.status(403).json({ error: 'Forbidden' })
  }
  const tenantId = req.tenant?._id || req.tenantId

  // Avoid composite index for doctor + date by fetching by doctor and filtering date in memory
  const allDocAttendance = await req.db(DoctorAttendance).find({ doctor: targetDoctor })
  let record = allDocAttendance.find(r => r.date === date)
  if (!record) {
    const recData = { doctor: targetDoctor, date, status: isSunday ? 'not-required' : 'unmarked' }
    if (tenantId) recData.tenantId = tenantId
    record = req.db(DoctorAttendance)._wrap(recData)
  }
  // Doctors can only mark once (from 'unmarked'); admins can override anytime
  if (req.userRole === 'doctor' && record.status && record.status !== 'unmarked') {
    return res.status(409).json({ error: 'Already marked for today' })
  }
  if (status) record.status = status
  if (typeof notes === 'string') record.notes = notes
  if (checkInAt) record.checkInAt = new Date(checkInAt)
  if (checkOutAt) record.checkOutAt = new Date(checkOutAt)
  await record.save()

  // Invalidate doctor attendance list caches
  try {
    await Promise.all([
      req.db(CacheAttendance).deleteMany({ tenantId }),
      delCache(`hms:doctorAttendance:list:${tenantId}:${date}:${targetDoctor}:${req.userRole}:${req.userId}`),
      delCache(`hms:doctorAttendance:list:${tenantId}:${date}::${req.userRole}:${req.userId}`)
    ])
  } catch (err) {
    console.warn('[doctor-attendance] failed to invalidate cache', err)
  }

  const populated = await req.db(DoctorAttendance).findById(record._id).populate('doctor', 'name email')
  res.status(201).json(populated)
})

export default router
