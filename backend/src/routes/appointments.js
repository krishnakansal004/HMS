import express from 'express'
import multer from 'multer'
import fs from 'fs'
import path from 'path'
import Appointment from '../models/Appointment.js'
import DoctorAvailability from '../models/DoctorAvailability.js'
import DoctorProfile from '../models/DoctorProfile.js'
import User from '../models/User.js'
import { sendEmail, sendSMS, sendWhatsApp, sendWhatsAppTemplate } from '../utils/notify.js'
import { protect, admin, doctor as requireDoctor } from '../utils/auth.js'
import tenantMiddleware from '../utils/tenant.js'
import { allowRolesWithSubadminFeature } from '../utils/permissions.js'
import { istDateString, istISOString } from '../utils/ist.js'
import Patient from '../models/Patient.js'
import { appointmentCancellationTemplate } from '../utils/emailTemplates.js'
import { triggerBackgroundUpdate } from '../services/cacheService.js'
import FirestoreModel from '../models/firestore/FirestoreModel.js'
import { getCache, setCache, delCachePattern } from '../utils/redis.js'

async function clearAppointmentsCache(tenantId) {
  try {
    const pattern = `hms:appointments:${tenantId || '*'}:*`
    await delCachePattern(pattern)
    console.log(`[Cache] Cleared appointments cache for pattern: ${pattern}`)
  } catch (err) {
    console.error('[Cache] Invalidation failed:', err.message)
  }
}

import { uploadAppointments, uploadToCloudinary } from '../config/cloudinary.js'

const router = express.Router()

// Cloudinary config handles limits and formats using memoryStorage
const upload = uploadAppointments

function dateToYmdIst(date) {
  const istDate = new Date(date.getTime() + 5.5 * 60 * 60 * 1000)
  const y = istDate.getUTCFullYear()
  const m = String(istDate.getUTCMonth() + 1).padStart(2, '0')
  const d = String(istDate.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function toYMD(date) {
  const ymdStr = typeof date === 'string' ? date : dateToYmdIst(new Date(date))
  const [y, m, d] = ymdStr.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d, 0, 0) - 5.5 * 60 * 60 * 1000)
}

function addMinutes(date, minutes) {
  return new Date(new Date(date).getTime() + minutes * 60000)
}

function hhmmToDate(baseDate, hhmm) {
  const ymdStr = typeof baseDate === 'string' ? baseDate : dateToYmdIst(new Date(baseDate))
  const [y, m, d] = ymdStr.split('-').map(Number)
  const [h, min] = (hhmm || '09:00').split(':').map(Number)
  return new Date(Date.UTC(y, m - 1, d, h, min) - 5.5 * 60 * 60 * 1000)
}

function getDoctorSlotsForDate(avail, day, ymdStr, dow) {
  const useDefaultSlots = !avail || !avail.days || !avail.days.some(d => d.enabled)
  const exceptionFound = avail && Array.isArray(avail.exceptions) && avail.exceptions.find(e => e.date === ymdStr)

  if (exceptionFound) {
    return []
  }

  let slots = []
  if (useDefaultSlots) {
    const defaultSlotTimes = [
      '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00',
      '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00'
    ]
    slots = defaultSlotTimes.map(timeStr => {
      const start = hhmmToDate(day, timeStr)
      const end = addMinutes(start, 30)
      return { start, end }
    })
  } else {
    const dayCfg = Array.isArray(avail.days) ? avail.days.find(d => d.dayOfWeek === dow) : null
    if (dayCfg && dayCfg.enabled) {
      const start = hhmmToDate(day, dayCfg.startTime)
      const end = hhmmToDate(day, dayCfg.endTime)
      const duration = Math.max(1, dayCfg.slotDurationMin || 15)
      for (let t = new Date(start); t < end; t = addMinutes(t, duration)) {
        const s = new Date(t)
        const e = addMinutes(s, duration)
        slots.push({ start: s, end: e })
      }
    }
  }
  return slots
}

async function getDoctorAvailability(req, doctorId) {
  let avail = await req.db(DoctorAvailability).findOne({ doctor: doctorId })
  if (!avail) {
    avail = await req.db(DoctorAvailability).create({ doctor: doctorId })
  }
  if (!avail.days || !Array.isArray(avail.days)) {
    avail.days = [0, 1, 2, 3, 4, 5, 6].map(dow => ({
      dayOfWeek: dow,
      enabled: false,
      startTime: '09:00',
      endTime: '17:00',
      slotDurationMin: 15
    }))
  }
  return avail
}

router.get('/', protect, tenantMiddleware, allowRolesWithSubadminFeature(['admin', 'director', 'doctor', 'subadmin'], 'view_appointments'), async (req, res) => {
  try {
    const { doctorId, date, status } = req.query
    const tenantId = req.tenant ? req.tenant._id : (req.user ? req.user.tenantId : undefined)

    const limit = Number(req.query.limit) || 100
    const page = Number(req.query.page) || 1
    const skip = (page - 1) * limit

    const cacheKey = `hms:appointments:${tenantId || ''}:${doctorId || ''}:${date || ''}:${status || ''}:${page}:${limit}`
    const cached = await getCache(cacheKey)
    if (cached) {
      console.log(`[Cache Hit] Serving appointments from cache: ${cacheKey}`)
      return res.json(cached)
    }

    const q = {}
    if (tenantId) q.tenantId = tenantId
    if (doctorId) q.doctor = doctorId
    if (status) q.status = status
    if (date) q.date = toYMD(date)

    const query = req.db(Appointment).find(q).sort({ slotStart: 1 })
    if (req.query.limit !== 'all') {
      query.limit(limit).skip(skip)
    }
    let list = await query.populate('doctor', 'name email role')

    await setCache(cacheKey, list, 300)
    res.json(list)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Server error' })
  }
})


// Authenticated user's appointments
router.get('/mine', protect, tenantMiddleware, async (req, res) => {
  try {
    if (!req.userId) return res.status(401).json({ error: 'Unauthorized' })
    const user = await User.findById(req.userId)
    const tenantId = req.tenant ? req.tenant._id : (req.user ? req.user.tenantId : undefined)

    const limit = Number(req.query.limit) || 100
    const page = Number(req.query.page) || 1
    const skip = (page - 1) * limit

    let query1 = []
    if (req.userId) {
      const q1 = { patientUser: req.userId }
      if (tenantId) q1.tenantId = tenantId
      query1 = await req.db(Appointment).find(q1).populate('doctor', 'name email role').sort({ slotStart: 1 })
    }

    let query2 = []
    if (user?.email) {
      const q2 = { patientEmail: user.email }
      if (tenantId) q2.tenantId = tenantId
      query2 = await req.db(Appointment).find(q2).populate('doctor', 'name email role').sort({ slotStart: 1 })
    }

    const mergedMap = new Map()
    query1.forEach(a => mergedMap.set(String(a._id || a.id), a))
    query2.forEach(a => mergedMap.set(String(a._id || a.id), a))
    let list = Array.from(mergedMap.values())

    list = list.filter(a => a.hiddenByPatient !== true)

    list.sort((a, b) => new Date(a.slotStart) - new Date(b.slotStart))

    if (req.query.limit !== 'all') {
      list = list.slice(skip, skip + limit)
    }

    // Manually join doctor names for appointments where populate may not have worked (Firestore)
    const doctorIds = [...new Set(list.map(a => {
      const docId = a.doctor?._id || a.doctor?.id || a.doctor
      return docId ? String(docId) : null
    }).filter(Boolean))]

    const doctorMap = {}
    if (doctorIds.length) {
      try {
        const doctors = await User.find({ _id: { $in: doctorIds } }, 'name email role')
        doctors.forEach(d => { doctorMap[String(d._id || d.id)] = d })
      } catch (e) { /* ignore */ }
    }

    // Attach doctor data to each appointment
    const enriched = list.map(a => {
      const raw = a.toJSON ? a.toJSON() : { ...a }
      const docId = String(raw.doctor?._id || raw.doctor?.id || raw.doctor || '')
      const docUser = doctorMap[docId]
      if (docUser && (!raw.doctor?.name)) {
        raw.doctor = { _id: docId, name: docUser.name, email: docUser.email, role: docUser.role }
      }
      // Also expose denormalized doctorName if doctor object still missing name
      if (!raw.doctor?.name && raw.doctorName) {
        raw.doctor = { ...(raw.doctor || {}), name: raw.doctorName }
      }
      return raw
    })

    res.json(enriched)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Server error' })
  }
})


// Get available slots and today's appointments in a single call
router.get('/slots-and-queue', protect, tenantMiddleware, async (req, res) => {
  try {
    const { doctorId, date } = req.query
    if (!doctorId || !date) return res.status(400).json({ error: 'doctorId and date required' })
    if (!doctorId.match(/^[a-zA-Z0-9_\-]{15,40}$/)) return res.status(400).json({ error: 'Invalid doctorId' })

    // 1. Fetch slots logic
    let freeSlots = []
    let slotsEnabled = true
    try {
      const prof = await req.db(DoctorProfile).findOne({ user: doctorId })
      if (!prof || prof.active === false) {
        slotsEnabled = false
      }
    } catch (e) { }

    if (slotsEnabled) {
      const day = new Date(date)
      const [y, m, d] = date.split('-').map(Number)
      const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
      const avail = await req.db(DoctorAvailability).findOne({ doctor: doctorId })
      const ymdStr = dateToYmdIst(day)
      const slots = getDoctorSlotsForDate(avail, day, ymdStr, dow)
        if (slots.length > 0) {
          const dayStart = toYMD(day)
          const dayEnd = new Date(dayStart); dayEnd.setDate(dayEnd.getDate() + 1)
          
          let doctorTenantId = null
          try {
            const docUser = await User.findById(doctorId).select('tenantId')
            if (docUser) doctorTenantId = docUser.tenantId
          } catch (e) { }

          const existingAll = await req.db(Appointment).find({
            doctor: doctorId
          })

          const existing = existingAll.filter(a => {
            if (a.status === 'cancelled') return false
            if (doctorTenantId && String(a.tenantId) !== String(doctorTenantId)) return false
            const aStart = new Date(a.slotStart)
            return aStart >= dayStart && aStart < dayEnd
          })

          const takenMap = new Set(existing.map(a => istISOString(new Date(a.slotStart))))
          freeSlots = slots.filter(s => !takenMap.has(istISOString(s.start)))
        }
      }

    // 2. Fetch today's appointments (queue) logic
    const tenantId = req.tenant ? req.tenant._id : (req.user ? req.user.tenantId : undefined)
    const q = {}
    if (tenantId) q.tenantId = tenantId
    if (doctorId) q.doctor = doctorId
    if (date) q.date = toYMD(new Date(date))

    const appointments = await req.db(Appointment).find(q).sort({ slotStart: 1 }).populate('doctor', 'name email role')

    res.json({
      slots: freeSlots,
      appointments
    })
  } catch (e) {
    console.error('slots-and-queue error', e)
    res.status(500).json({ error: 'Server error' })
  }
})

// Get available slots for a date
router.get('/slots', async (req, res) => {
  try {
    const { doctorId, date } = req.query
    if (!doctorId || !date) return res.status(400).json({ error: 'doctorId and date required' })
    if (!doctorId.match(/^[a-zA-Z0-9_\-]{15,40}$/)) return res.status(400).json({ error: 'Invalid doctorId' })

    let tenantId = null
    try {
      const docUser = await User.findById(doctorId).select('tenantId')
      if (docUser) tenantId = docUser.tenantId
    } catch (e) { }

    if (!req.db) {
      req.db = (modelOrName) => {
        const actualTenantId = tenantId || null
        if (typeof modelOrName === 'string') {
          return new FirestoreModel(modelOrName, actualTenantId)
        }
        return modelOrName.forHospital(actualTenantId)
      }
    }

    // Ensure doctor is active before returning slots
    try {
      const prof = await req.db(DoctorProfile).findOne({ user: doctorId })
      if (!prof || prof.active === false) return res.json([])
    } catch (e) { /* ignore and continue */ }

    const day = new Date(date)
    const [y, m, d] = date.split('-').map(Number)
    const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
    const avail = await req.db(DoctorAvailability).findOne({ doctor: doctorId })
    const ymdStr = dateToYmdIst(day)

    const slots = getDoctorSlotsForDate(avail, day, ymdStr, dow)
    if (slots.length === 0) return res.json([])

    // Exclude existing appointments
    const dayStart = toYMD(day)
    const dayEnd = new Date(dayStart); dayEnd.setDate(dayEnd.getDate() + 1)
    const existingAll = await req.db(Appointment).find({
      doctor: doctorId
    })

    const existing = existingAll.filter(a => {
      if (a.status === 'cancelled') return false
      if (tenantId && String(a.tenantId) !== String(tenantId)) return false
      const aStart = new Date(a.slotStart)
      return aStart >= dayStart && aStart < dayEnd
    })

    const takenMap = new Set(existing.map(a => istISOString(new Date(a.slotStart))))
    const free = slots.filter(s => !takenMap.has(istISOString(s.start)))
    res.json(free)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Server error' })
  }
})

// Create appointment (online or walk-in)
router.post('/', upload.fields([{ name: 'voice', maxCount: 1 }, { name: 'docs', maxCount: 20 }]), async (req, res) => {
  try {
    // Accept body fields from either JSON or multipart/form-data
    const body = req.body || {}
    const { doctorId, patientName, patientPhone, patientEmail, type = 'online', date, slotStart, diseaseText, medicineHistory } = body

    // 1. Input Validation
    if (!doctorId) {
      return res.status(400).json({ success: false, code: 'VALIDATION_ERROR', message: 'doctorId is required' })
    }
    if (!doctorId.match(/^[a-zA-Z0-9_\-]{15,40}$/)) {
      return res.status(400).json({ success: false, code: 'VALIDATION_ERROR', message: 'Invalid doctorId format' })
    }
    if (!date) {
      return res.status(400).json({ success: false, code: 'VALIDATION_ERROR', message: 'date is required' })
    }
    if (!date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return res.status(400).json({ success: false, code: 'VALIDATION_ERROR', message: 'Invalid date format, expected YYYY-MM-DD' })
    }
    if (!slotStart) {
      return res.status(400).json({ success: false, code: 'VALIDATION_ERROR', message: 'slotStart is required' })
    }
    const start = new Date(slotStart)
    if (isNaN(start.getTime())) {
      return res.status(400).json({ success: false, code: 'VALIDATION_ERROR', message: 'Invalid slotStart format' })
    }
    if (type !== 'online' && type !== 'walk-in') {
      return res.status(400).json({ success: false, code: 'VALIDATION_ERROR', message: 'Invalid consultation mode, expected online or walk-in' })
    }
    if (!patientName) {
      return res.status(400).json({ success: false, code: 'VALIDATION_ERROR', message: 'patientName is required' })
    }

    let tenantId = req.tenant ? req.tenant._id : undefined
    if (!tenantId && doctorId) {
      try {
        const d = await User.findById(doctorId).select('tenantId')
        if (d) tenantId = d.tenantId
      } catch (e) { }
    }
    if (!tenantId) {
      return res.status(400).json({ success: false, code: 'VALIDATION_ERROR', message: 'tenantId is required' })
    }

    if (!req.db) {
      req.db = (modelOrName) => {
        const actualTenantId = tenantId || null
        if (typeof modelOrName === 'string') {
          return new FirestoreModel(modelOrName, actualTenantId)
        }
        return modelOrName.forHospital(actualTenantId)
      }
    }

    // 2. Prevent booking against inactive/deleted doctors
    try {
      const prof = await req.db(DoctorProfile).findOne({ user: doctorId })
      if (!prof || prof.active === false) {
        return res.status(409).json({ success: false, code: 'DOCTOR_UNAVAILABLE', message: 'Doctor is unavailable' })
      }
    } catch (e) {
      // ignore DB check errors and continue
    }

    const day = new Date(date)
    const dayStart = toYMD(day)
    const dayEnd = new Date(dayStart); dayEnd.setDate(dayEnd.getDate() + 1)

    // 3. Compute available slots for the day
    const avail = await req.db(DoctorAvailability).findOne({ doctor: doctorId })
    const ymd = new Date(day.getTime()); ymd.setHours(0, 0, 0, 0)
    const ymdStr = istDateString(ymd)
    const dow = day.getDay()

    const slots = getDoctorSlotsForDate(avail, day, ymdStr, dow)

    // Check if the doctor has any slots on that day
    if (slots.length === 0) {
      return res.status(409).json({ success: false, code: 'DOCTOR_UNAVAILABLE', message: 'Doctor is unavailable' })
    }

    // Ensure slot matches one of the generated slots exactly
    const matchingSlot = slots.find(s => s.start.getTime() === start.getTime())
    if (!matchingSlot) {
      return res.status(409).json({ success: false, code: 'DOCTOR_UNAVAILABLE', message: 'Doctor is unavailable' })
    }
    const end = matchingSlot.end

    // 4. Check collision in DB (only non-cancelled appointments at same slotStart)
    const clash = await req.db(Appointment).findOne({ doctor: doctorId, slotStart: start })
    if (clash && clash.status !== 'cancelled' && (!tenantId || String(clash.tenantId) === String(tenantId))) {
      return res.status(409).json({ success: false, code: 'SLOT_ALREADY_BOOKED', message: 'Selected slot already booked' })
    }

    // Token number for the day - computed efficiently using db count
    const count = await req.db(Appointment).countDocuments({
      doctor: doctorId,
      date: dayStart,
      ...(tenantId ? { tenantId } : {})
    })
    const tokenNumber = count + 1

    const appointmentData = {
      doctor: doctorId,
      patientUser: req.userId || undefined,
      patientName, patientPhone, patientEmail,
      type,
      createdBy: req.userId || undefined,
      date: dayStart,
      slotStart: start,
      slotEnd: end,
      tokenNumber,
      status: 'scheduled',
      diseaseText: diseaseText || undefined,
      medicineHistory: medicineHistory || undefined,
    }

    // Attempt to link to an existing Patient document (by email or phone) for richer doctor view
    try {
      let patientDoc = null
      if (patientEmail) {
        const qEmail = { email: patientEmail }
        if (tenantId) qEmail.tenantId = tenantId
        patientDoc = await req.db(Patient).findOne(qEmail).select('_id')
      }
      if (!patientDoc && patientPhone) {
        const qPhone = { phone: patientPhone }
        if (tenantId) qPhone.tenantId = tenantId
        patientDoc = await req.db(Patient).findOne(qPhone).select('_id')
      }
      if (patientDoc) appointmentData.patient = patientDoc._id
    } catch (e) {
      // ignore lookup errors
    }

    // Attach files saved by multer in memory, uploading each one to Cloudinary manually
    if (req.files) {
      if (req.files.voice && req.files.voice.length) {
        const v = req.files.voice[0]
        try {
          const cldObj = await uploadToCloudinary(v.buffer, 'appointments', 'auto')
          appointmentData.voiceMessage = {
            filename: v.originalname,
            originalname: v.originalname,
            path: cldObj.secure_url, // Secure Cloudinary URL
            mimetype: v.mimetype,
            size: v.size
          }
        } catch (e) {
          console.error('Cloudinary voice upload failed:', e.message)
        }
      }
      if (req.files.docs && req.files.docs.length) {
        appointmentData.docs = []
        const uploadPromises = req.files.docs.map(async (d) => {
          try {
            const cldObj = await uploadToCloudinary(d.buffer, 'appointments', 'auto')
            return {
              filename: d.originalname,
              originalname: d.originalname,
              path: cldObj.secure_url,
              mimetype: d.mimetype,
              size: d.size
            }
          } catch (e) {
            console.error('Cloudinary doc upload failed:', e.message)
            return null
          }
        })
        const uploadedDocs = await Promise.all(uploadPromises)
        appointmentData.docs = uploadedDocs.filter(Boolean)
      }
    }

    // If the client provided an invoiceId (e.g., payment happened before creating appointment), attach it
    if (body.invoiceId) {
      try {
        appointmentData.invoice = body.invoiceId
      } catch (e) {
        // ignore malformed invoiceId
      }
    }

    // attach tenantId to appointment to enforce ownership
    if (!tenantId) {
      tenantId = req.tenant ? req.tenant._id : (req.user ? req.user.tenantId : undefined)
    }
    if (tenantId) appointmentData.tenantId = tenantId
    // Pre-fetch doctor to denormalize name (ensures it shows in patient view without populate)
    const doctorUser = await User.findById(doctorId)
    if (doctorUser?.name) appointmentData.doctorName = doctorUser.name
    const appointment = await req.db(Appointment).create(appointmentData)
    clearAppointmentsCache(tenantId)
    // Fire and forget notifications
    const doctor = doctorUser
    const subject = `Appointment Confirmed - Token #${tokenNumber}`
    const company = process.env.COMPANY_NAME || 'PharmaPlus'
    const logo = process.env.COMPANY_LOGO_URL || ''
    const whenStr = start.toLocaleString()
    const msg = `Dear ${patientName}, your appointment with Dr. ${doctor?.name || ''} is scheduled on ${whenStr}. Token #${tokenNumber}.`
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8" />
      <style>body{font-family:Arial,Helvetica,sans-serif;background:#f6f9fc;margin:0;padding:0;color:#334155} .container{max-width:600px;margin:32px auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden} .header{background:#5942ff;color:#ffffff;padding:20px;text-align:center} .logo{max-height:48px;margin-bottom:12px} .content{padding:24px} h1{font-size:20px;margin:0 0 16px;font-weight:600} table{width:100%;border-collapse:collapse;margin:16px 0} td{padding:8px 6px;font-size:14px} .label{color:#64748b;width:140px} .footer{font-size:12px;color:#64748b;padding:16px;background:#f8fafc;text-align:center} .badge{display:inline-block;background:#10b981;color:#fff;border-radius:4px;padding:2px 6px;font-size:12px;font-weight:600} a{color:#5942ff;text-decoration:none}</style>
      </head><body><div class="container">
      <div class="header">${logo ? `<img src='${logo}' alt='${company} logo' class='logo' />` : ''}<div style="font-size:22px;font-weight:600">${company}</div></div>
      <div class="content">
      <h1>Appointment Confirmed</h1>
      <p>Dear <strong>${patientName}</strong>, your appointment has been successfully scheduled. Please arrive 10 minutes early for any preliminary formalities.</p>
      <table>
        <tr><td class="label">Doctor</td><td>Dr. ${doctor?.name || ''}</td></tr>
        <tr><td class="label">Date & Time</td><td>${whenStr}</td></tr>
        <tr><td class="label">Token Number</td><td><span class="badge">#${tokenNumber}</span></td></tr>
        <tr><td class="label">Status</td><td>Scheduled</td></tr>
      </table>
      <p style="margin-top:16px">If you need to reschedule or cancel, please contact us at <a href="mailto:${process.env.REPLY_TO || 'support@iitiancraft.com'}">${process.env.REPLY_TO || 'support@iitiancraft.com'}</a>.</p>
      <p style="margin-top:16px;font-size:13px;color:#64748b">This is an automated message – please do not reply directly.</p>
      </div>
      <div class="footer">&copy; ${new Date().getFullYear()} ${company}. All rights reserved.</div>
      </div></body></html>`
    sendEmail(patientEmail, subject, html).catch(() => { })
    if (process.env.TWILIO_FROM) {
      sendSMS(patientPhone, msg).catch(() => { })
    }
    const waText = `*${company}*\nAppointment Confirmed\n\nPatient: ${patientName}\nDoctor: Dr. ${doctor?.name || ''}\nWhen: ${whenStr}\nToken: #${tokenNumber}\nStatus: Scheduled\n\nFor changes, contact ${process.env.REPLY_TO || 'support@iitiancraft.com'}`
    const confirmTemplate = process.env.TWILIO_WA_CONTENT_SID_CONFIRM
    if (confirmTemplate) {
      sendWhatsAppTemplate(patientPhone, confirmTemplate, {
        company,
        patient: patientName,
        doctor: doctor?.name || '',
        when: whenStr,
        token: `#${tokenNumber}`,
        supportEmail: process.env.REPLY_TO || 'support@iitiancraft.com',
      }).catch(() => { })
    } else {
      sendWhatsApp(patientPhone, waText).catch(() => { })
    }
    // Optional: notify doctor as well if enabled
    if (process.env.NOTIFY_DOCTOR_ON_BOOKING === 'true' && doctor) {
      const dSubject = `New Appointment Booked - Token #${tokenNumber}`
      const dMsg = `New appointment: ${patientName} on ${start.toLocaleString()} (Token #${tokenNumber}).`
      if (doctor.email) sendEmail(doctor.email, dSubject, `<p>${dMsg}</p>`).catch(() => { })
      if (doctor.phone) {
        sendSMS(doctor.phone, dMsg).catch(() => { })
        sendWhatsApp(doctor.phone, dMsg).catch(() => { })
      }
    }
    triggerBackgroundUpdate(tenantId)
    res.status(201).json(appointment)
  } catch (e) {
    console.error('--- EXCEPTION CAUGHT IN POST /api/appointments ---')
    console.error('Error message:', e?.message || String(e))
    console.error('Stack trace:', e?.stack)
    console.error('Payload:', JSON.stringify(req.body))
    console.error('doctorId:', req.body?.doctorId)
    console.error('patientId/patientUser:', req.userId || req.body?.patientUser)
    console.error('tenantId:', req.tenant?._id || req.user?.tenantId || req.body?.tenantId)
    console.error('slotStart:', req.body?.slotStart)
    console.error('paymentStatus:', req.body?.paymentStatus || 'unknown')
    console.error('--------------------------------------------------')

    if (e?.code === 11000 && e?.keyPattern?.doctor && e?.keyPattern?.slotStart) {
      return res.status(409).json({ success: false, code: 'SLOT_ALREADY_BOOKED', message: 'Selected slot already booked' })
    }
    res.status(500).json({ error: e?.message || String(e), stack: e?.stack })
  }
})

// Update status or reschedule
router.patch('/:id', protect, tenantMiddleware, allowRolesWithSubadminFeature(['admin', 'director', 'doctor', 'subadmin'], 'manage_appointments'), async (req, res) => {
  try {
    const { status, slotStart, meetingLink, sendMeetingEmail, emailOverride } = req.body
    const tenantId = req.tenant ? req.tenant._id : (req.user ? req.user.tenantId : undefined)
    const appt = await req.db(Appointment).findById(req.params.id)
    if (!appt) return res.status(404).json({ error: 'Not found' })
    if (req.user && req.user.role === 'doctor') {
      if (String(appt.doctor) !== String(req.userId)) return res.status(403).json({ error: 'Forbidden' })
    } else if (tenantId && String(appt.tenantId) !== String(tenantId)) {
      return res.status(403).json({ error: 'Forbidden tenant mismatch' })
    }
    if (slotStart) {
      // reschedule - keep same duration
      const avail = await getDoctorAvailability(req, appt.doctor)
      const day = new Date(slotStart)
      const dow = day.getDay()
      const dayCfg = avail.days.find(d => d.dayOfWeek === dow)
      if (!dayCfg || !dayCfg.enabled) return res.status(400).json({ error: 'Doctor not available on that day' })
      const newStart = new Date(slotStart)
      const newEnd = addMinutes(newStart, dayCfg.slotDurationMin || 15)
      const clashQ = { doctor: appt.doctor, slotStart: newStart, _id: { $ne: appt._id }, status: { $ne: 'cancelled' } }
      if (tenantId) clashQ.tenantId = tenantId
      const clash = await req.db(Appointment).findOne(clashQ)
      if (clash) return res.status(409).json({ success: false, code: 'SLOT_ALREADY_BOOKED', message: 'Selected slot already booked' })
      appt.slotStart = newStart
      appt.slotEnd = newEnd
      appt.date = toYMD(newStart)
    }
    if (status) appt.status = status
    if (meetingLink !== undefined) appt.meetingLink = meetingLink
    await appt.save()
    clearAppointmentsCache(tenantId || appt.tenantId)

    // Optionally send meeting link email notification
    if (sendMeetingEmail && (appt.patientEmail || emailOverride) && (meetingLink || appt.meetingLink)) {
      try {
        const doctor = await User.findById(appt.doctor, 'name email')
        const to = emailOverride || appt.patientEmail
        const whenStr = new Date(appt.slotStart).toLocaleString()
        const company = process.env.COMPANY_NAME || 'PharmaPlus'
        const subject = `${company}: Online Consultation Link`
        const html = `<!DOCTYPE html><html><head><meta charset="utf-8" /><style>body{font-family:Segoe UI,Arial,sans-serif;background:#f5f7fa;margin:0;padding:0} .box{max-width:640px;margin:24px auto;background:#fff;border-radius:12px;box-shadow:0 2px 6px rgba(0,0,0,.08);overflow:hidden} .head{background:#5942ff;color:#fff;padding:16px 20px;font-weight:600} .content{padding:24px} .label{color:#64748b;width:140px} table{width:100%;border-collapse:collapse} td{padding:6px 4px;font-size:14px} .btn{display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:600;margin-top:12px}</style></head><body>
        <div class="box"><div class="head">Online Consultation Details</div><div class="content">
        <p>Dear ${appt.patientName || 'Patient'},</p>
        <p>Your appointment with <strong>Dr. ${doctor?.name || ''}</strong> is scheduled on <strong>${whenStr}</strong>.</p>
        <table><tr><td class="label">Meeting Link</td><td><a href="${meetingLink || appt.meetingLink}" target="_blank" rel="noopener">Join Meeting</a></td></tr>
        <tr><td class="label">Token Number</td><td>#${appt.tokenNumber}</td></tr></table>
        <a class="btn" href="${meetingLink || appt.meetingLink}" target="_blank" rel="noopener">Join at the scheduled time</a>
        <p style="font-size:12px;color:#64748b;margin-top:16px">If the button does not work, copy and paste this URL into your browser: ${meetingLink || appt.meetingLink}</p>
        </div></div></body></html>`
        await sendEmail(to, subject, html)
        appt.notifications = appt.notifications || {}
        appt.notifications.meetingLinkEmailAt = new Date()
        await appt.save().catch(() => { })
      } catch (e) {
        console.warn('meeting link email failed:', e?.message || e)
      }
    }

    triggerBackgroundUpdate(tenantId)
    res.json(appt)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Server error' })
  }
})

// Patient hide (delete) their own appointment from patient view
router.patch('/hide/:id', protect, tenantMiddleware, async (req, res) => {
  try {
    const tenantId = req.tenant ? req.tenant._id : (req.user ? req.user.tenantId : undefined)
    const appt = await req.db(Appointment).findOne({ _id: req.params.id, ...(tenantId ? { tenantId } : {}) })
    if (!appt) return res.status(404).json({ error: 'Not found' })
    const user = await User.findById(req.userId).select('email role')
    if (!user) return res.status(404).json({ error: 'User not found' })
    // Only patient owners can hide
    const isOwner = (appt.patientUser && String(appt.patientUser) === String(req.userId)) || (user.email && appt.patientEmail && appt.patientEmail.toLowerCase() === user.email.toLowerCase())
    if (!isOwner) return res.status(403).json({ error: 'Forbidden' })
    appt.hiddenByPatient = true
    await appt.save()
    clearAppointmentsCache(tenantId || appt.tenantId)
    res.json({ ok: true })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Server error' })
  }
})

// Delete (cancel)
router.delete('/:id', protect, tenantMiddleware, allowRolesWithSubadminFeature(['admin', 'director', 'doctor', 'subadmin'], 'manage_appointments'), async (req, res) => {
  try {
    const tenantId = req.tenant ? req.tenant._id : (req.user ? req.user.tenantId : undefined)
    const appt = await req.db(Appointment).findOne({ _id: req.params.id, ...(tenantId ? { tenantId } : {}) })
    if (!appt) return res.status(404).json({ error: 'Not found' })
    appt.status = 'cancelled'
    // Capture cancellation reason from body or query
    const reason = req.body?.cancellationReason || req.query?.reason
    if (reason) appt.cancellationReason = reason
    await appt.save()
    // Prepare and send cancellation email if patientEmail exists
    if (appt.patientEmail) {
      try {
        const doctor = await User.findById(appt.doctor, 'name email')
        const { html, attachments } = appointmentCancellationTemplate({ appointment: appt, doctor, tenant: req.tenant })
        const subject = `${process.env.COMPANY_NAME || 'PharmaPlus HMS'}: Appointment Cancelled`
        await sendEmail(appt.patientEmail, subject, html, attachments?.length ? { attachments } : undefined)
        appt.notifications = appt.notifications || {}
        appt.notifications.cancellation = appt.notifications.cancellation || {}
        appt.notifications.cancellation.emailAt = new Date()
      } catch (e) {
        console.warn('appointment cancellation email failed:', e?.message || e)
      }
    }
    // Optional SMS/WhatsApp notifications
    if (appt.patientPhone) {
      const whenStr = new Date(appt.slotStart).toLocaleString()
      const company = process.env.COMPANY_NAME || 'PharmaPlus'
      const docUser = await User.findById(appt.doctor, 'name')
      const baseMsg = `Your appointment on ${whenStr} with Dr. ${docUser?.name || ''} has been cancelled.`
      sendSMS(appt.patientPhone, `${company}: ${baseMsg}`).then(() => {
        appt.notifications = appt.notifications || {}
        appt.notifications.cancellation = appt.notifications.cancellation || {}
        appt.notifications.cancellation.smsAt = new Date()
        appt.markModified('notifications')
        appt.save().catch(() => { })
      }).catch(() => { })
      sendWhatsApp(appt.patientPhone, `*${company}*\n${baseMsg}\nStatus: Cancelled`).then(() => {
        appt.notifications = appt.notifications || {}
        appt.notifications.cancellation = appt.notifications.cancellation || {}
        appt.notifications.cancellation.whatsappAt = new Date()
        appt.markModified('notifications')
        appt.save().catch(() => { })
      }).catch(() => { })
    }
    // Final save for email timestamp if set
    if (appt.isModified('notifications')) {
      appt.markModified('notifications')
      await appt.save().catch(() => { })
    }
    triggerBackgroundUpdate(tenantId)
    clearAppointmentsCache(tenantId || appt.tenantId)
    res.json({ ok: true })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Server error' })
  }
})

// Bulk cancel (e.g., doctor leave)
router.post('/bulk-cancel', async (req, res) => {
  try {
    const { doctorId, startDate, endDate, reason } = req.body
    if (!doctorId || !startDate || !endDate) return res.status(400).json({ error: 'doctorId, startDate, endDate required' })
    const start = new Date(startDate); const end = new Date(endDate)
    if (isNaN(start) || isNaN(end)) return res.status(400).json({ error: 'Invalid dates' })
    // Ensure inclusive end by adding 1 day at midnight
    const endInclusive = new Date(end); endInclusive.setDate(endInclusive.getDate() + 1)
    const allDocAppts = await req.db(Appointment).find({ doctor: doctorId })
    const startDateVal = toYMD(start).getTime()
    const endDateInclusiveVal = toYMD(endInclusive).getTime()

    const appts = allDocAppts.filter(a => {
      if (a.status === 'cancelled') return false
      if (tenantId && String(a.tenantId) !== String(tenantId)) return false
      const d = a.date ? new Date(a.date).getTime() : (a.slotStart ? toYMD(a.slotStart).getTime() : 0)
      return d >= startDateVal && d < endDateInclusiveVal
    })
    const doctor = await User.findById(doctorId, 'name email')
    
    await Promise.all(appts.map(async (appt) => {
      appt.status = 'cancelled'
      if (reason) appt.cancellationReason = reason
      appt.notifications = appt.notifications || {}
      appt.notifications.cancellation = appt.notifications.cancellation || {}
      // Send notifications (best-effort)
      try {
        if (appt.patientEmail) {
          const { html, attachments } = appointmentCancellationTemplate({ appointment: appt, doctor })
          const subject = `${process.env.COMPANY_NAME || 'PharmaPlus HMS'}: Appointment Cancelled`
          await sendEmail(appt.patientEmail, subject, html, attachments?.length ? { attachments } : undefined)
          appt.notifications.cancellation.emailAt = new Date()
        }
      } catch (_) { }
      try {
        if (appt.patientPhone) {
          const whenStr = new Date(appt.slotStart).toLocaleString()
          const company = process.env.COMPANY_NAME || 'PharmaPlus'
          const baseMsg = `Your appointment on ${whenStr} with Dr. ${doctor?.name || ''} has been cancelled.`
          await sendSMS(appt.patientPhone, `${company}: ${baseMsg}`)
          appt.notifications.cancellation.smsAt = new Date()
          await sendWhatsApp(appt.patientPhone, `*${company}*\n${baseMsg}\nStatus: Cancelled`).catch(() => { })
          appt.notifications.cancellation.whatsappAt = new Date()
        }
      } catch (_) { }
      appt.markModified('notifications')
      await appt.save().catch(() => { })
    }))
    const cancelled = appts.length;
    triggerBackgroundUpdate(req.tenant?._id || req.user?.tenantId)
    clearAppointmentsCache(req.tenant?._id || req.user?.tenantId)
    res.json({ ok: true, total: appts.length, cancelled })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Server error' })
  }
})

// List appointments for a specific patient (doctor's own)
router.get('/by-patient', requireDoctor, async (req, res) => {
  try {
    const { patientId } = req.query
    if (!patientId) return res.status(400).json({ error: 'patientId required' })
    const tenantId = req.tenant ? req.tenant._id : (req.user ? req.user.tenantId : undefined)
    const patient = await req.db(Patient).findOne({ _id: patientId, ...(tenantId ? { tenantId } : {}) }).select('email firstName lastName phone')
    if (!patient) return res.status(404).json({ error: 'Patient not found' })
    const q = { doctor: req.userId }
    if (patient.email) q.patientEmail = patient.email
    // If no email on file, fallback to name match (best-effort)
    if (!patient.email && patient.firstName) {
      q.patientName = new RegExp(`^${patient.firstName}`, 'i')
    }
    if (tenantId) q.tenantId = tenantId
    const list = await req.db(Appointment).find(q).sort({ slotStart: -1 })
    res.json(list)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Server error' })
  }
})

// Doctor's booked patients (unique) with latest appointment info
router.get('/doctor-patients', requireDoctor, async (req, res) => {
  console.log('GET /doctor-patients hit by user:', req.userId);
  try {
    const doctorId = req.userId
    // Relaxed filter: Allow doctors to see ALL their patients regardless of tenant mismatch
    // Avoid Firestore inequality + orderBy mismatch by fetching all and filtering in-memory
    const allAppts = await req.db(Appointment).find({ doctor: doctorId })
      .select('patientName patientEmail patientPhone slotStart type status tokenNumber meetingLink patient patientUser')

    const appts = allAppts
      .filter(a => a.status !== 'cancelled')
      .sort((a, b) => new Date(b.slotStart) - new Date(a.slotStart))

    const map = new Map()
    for (const a of appts) {
      const key = (a.patientEmail && `email:${a.patientEmail}`) || (a.patientPhone && `phone:${a.patientPhone}`) || `name:${a.patientName}` || `id:${a._id}`
      if (!map.has(key)) {
        map.set(key, {
          key,
          displayName: a.patientName || 'Unknown',
          email: a.patientEmail || null,
          phone: a.patientPhone || null,
          patientId: a.patient || a.patientUser || null,
          totalAppointments: 0,
          lastAppointmentAt: null,
          nextAppointmentAt: null,
          latestAppointment: null,
          nextAppointment: null,
          appointments: [],
        })
      }
      const entry = map.get(key)
      entry.totalAppointments += 1
      const when = new Date(a.slotStart)
      
      // Update patientId if missing but found in later appointment
      if (!entry.patientId && (a.patient || a.patientUser)) {
        entry.patientId = a.patient || a.patientUser
      }

      // Collect the full appointment list (lightweight fields only)
      entry.appointments.push({
        _id: a._id,
        patient: a.patient,
        patientUser: a.patientUser,
        slotStart: a.slotStart,
        type: a.type,
        status: a.status,
        tokenNumber: a.tokenNumber,
        meetingLink: a.meetingLink || null,
      })
      // latestAppointment as the most recent past or upcoming if none past yet (we sorted desc)
      if (!entry.latestAppointment) entry.latestAppointment = a
      // track last and next
      if (when < new Date()) {
        if (!entry.lastAppointmentAt || when > entry.lastAppointmentAt) entry.lastAppointmentAt = when
      } else {
        if (!entry.nextAppointmentAt || when < entry.nextAppointmentAt) entry.nextAppointmentAt = when
        if (!entry.nextAppointment || when < new Date(entry.nextAppointment.slotStart)) entry.nextAppointment = a
      }
    }

    // Attempt to resolve patient IDs directly, as indexing by email/phone was causing missing _ids
    const patientIds = Array.from(map.values()).map(v => v.patientId).filter(Boolean)
    const uniquePatientIds = [...new Set(patientIds.map(String))]
    
    // Chunk requests by 30 for Firestore $in query limits
    const chunkSize = 30
    const chunks = []
    for (let i = 0; i < uniquePatientIds.length; i += chunkSize) {
      chunks.push(uniquePatientIds.slice(i, i + chunkSize))
    }

    const chunkPromises = chunks.map(async (chunk) => {
      try {
        return await req.db(Patient).find({ _id: { $in: chunk } })
            .select('firstName lastName email phone gender dob _id')
      } catch (err) {
        console.warn('Could not fetch patient chunk', err)
        return []
      }
    })

    const chunkResults = await Promise.all(chunkPromises)
    const patientDocs = chunkResults.flat()
    
    const patientById = new Map(patientDocs.map(p => [String(p._id || p.id), p]))

    const out = Array.from(map.values()).map(v => {
      const patientDoc = v.patientId ? patientById.get(String(v.patientId)) : null
      
      if (v.appointments && v.appointments.length) {
        v.appointments.sort((a, b) => new Date(b.slotStart) - new Date(a.slotStart))
      }
      
      return {
        _id: patientDoc ? String(patientDoc._id || patientDoc.id) : (v.patientId ? String(v.patientId) : v.key),
        name: patientDoc ? `${patientDoc.firstName}${patientDoc.lastName ? ' ' + patientDoc.lastName : ''}` : v.displayName,
        email: patientDoc ? patientDoc.email : v.email,
        phone: patientDoc ? patientDoc.phone : v.phone,
        patientId: patientDoc ? String(patientDoc._id || patientDoc.id) : v.patientId,
        gender: patientDoc ? patientDoc.gender : null,
        dob: patientDoc ? patientDoc.dob : null,
        totalAppointments: v.totalAppointments,
        lastAppointmentAt: v.lastAppointmentAt,
        nextAppointmentAt: v.nextAppointmentAt,
        latestAppointment: v.latestAppointment,
        nextAppointment: v.nextAppointment,
        appointments: v.appointments || [],
      }
    }).sort((a, b) => {
      const aWhen = a.lastAppointmentAt || a.nextAppointmentAt || 0
      const bWhen = b.lastAppointmentAt || b.nextAppointmentAt || 0
      return bWhen - aWhen
    })
    console.log(`Returning ${out.length} unique patients to frontend`);
    res.json(out)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Server error' })
  }
})

// (single-appointment route will be defined after the admin '/patients' route to avoid catching literal subpaths)

// Admin: aggregated patients who booked appointments (all doctors)
router.get('/patients', protect, tenantMiddleware, allowRolesWithSubadminFeature(['admin', 'director', 'subadmin'], 'view_appointments'), async (req, res) => {
  try {
    // optional filters: status, startDate, endDate
    const { status, startDate, endDate, q } = req.query
    const findQ = {}
    if (status) findQ.status = status
    if (startDate || endDate) {
      findQ.date = {}
      if (startDate) findQ.date.$gte = new Date(startDate)
      if (endDate) {
        const end = new Date(endDate)
        // include end day
        end.setDate(end.getDate() + 1)
        findQ.date.$lt = end
      }
    }
    const tenantId = req.tenant ? req.tenant._id : (req.user ? req.user.tenantId : undefined)
    if (tenantId) findQ.tenantId = tenantId
    const rawAppts = await req.db(Appointment).find(findQ).sort({ slotStart: -1 })
      .select('patientName patientEmail patientPhone slotStart status tokenNumber doctor cancellationReason')
      .populate('doctor', 'name')

    let appts = rawAppts
    if (q) {
      const lowerQ = q.toLowerCase()
      appts = rawAppts.filter(a => 
        (a.patientName && a.patientName.toLowerCase().includes(lowerQ)) ||
        (a.patientEmail && a.patientEmail.toLowerCase().includes(lowerQ)) ||
        (a.patientPhone && a.patientPhone.includes(lowerQ))
      )
    }

    const map = new Map()
    for (const a of appts) {
      const key = (a.patientEmail && `email:${a.patientEmail}`) || (a.patientPhone && `phone:${a.patientPhone}`) || `name:${a.patientName}`
      if (!map.has(key)) {
        map.set(key, {
          key,
          displayName: a.patientName,
          email: a.patientEmail || null,
          phone: a.patientPhone || null,
          totalAppointments: 0,
          lastAppointmentAt: null,
          nextAppointmentAt: null,
          appointments: [],
        })
      }
      const entry = map.get(key)
      entry.totalAppointments += 1
      entry.appointments.push({ _id: a._id, slotStart: a.slotStart, status: a.status, tokenNumber: a.tokenNumber, doctor: a.doctor, cancellationReason: a.cancellationReason })
      const when = new Date(a.slotStart)
      if (when < new Date()) {
        if (!entry.lastAppointmentAt || when > entry.lastAppointmentAt) entry.lastAppointmentAt = when
      } else {
        if (!entry.nextAppointmentAt || when < entry.nextAppointmentAt) entry.nextAppointmentAt = when
      }
    }

    // enrich with Patient docs if possible
    const emails = Array.from(map.values()).map(v => v.email).filter(Boolean)
    const phones = Array.from(map.values()).map(v => v.phone).filter(Boolean)
    const [byEmail, byPhone] = await Promise.all([
      emails.length ? req.db(Patient).find({ email: { $in: emails } }).select('firstName lastName email phone gender dob _id') : [],
      phones.length ? req.db(Patient).find({ phone: { $in: phones } }).select('firstName lastName email phone gender dob _id') : [],
    ])
    const patientByEmail = new Map(byEmail.map(p => [p.email, p]))
    const patientByPhone = new Map(byPhone.map(p => [p.phone, p]))

    const out = Array.from(map.values()).map(v => {
      let patientDoc = null
      if (v.email && patientByEmail.has(v.email)) patientDoc = patientByEmail.get(v.email)
      else if (v.phone && patientByPhone.has(v.phone)) patientDoc = patientByPhone.get(v.phone)
      v.appointments.sort((a, b) => new Date(b.slotStart) - new Date(a.slotStart))
      return {
        name: patientDoc ? `${patientDoc.firstName}${patientDoc.lastName ? ' ' + patientDoc.lastName : ''}` : v.displayName,
        email: v.email,
        phone: v.phone,
        patientId: patientDoc ? patientDoc._id : null,
        gender: patientDoc ? patientDoc.gender : null,
        dob: patientDoc ? patientDoc.dob : null,
        totalAppointments: v.totalAppointments,
        lastAppointmentAt: v.lastAppointmentAt,
        nextAppointmentAt: v.nextAppointmentAt,
        appointments: v.appointments || [],
      }
    }).sort((a, b) => {
      const aWhen = a.lastAppointmentAt || a.nextAppointmentAt || 0
      const bWhen = b.lastAppointmentAt || b.nextAppointmentAt || 0
      return bWhen - aWhen
    })

    res.json(out)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Server error' })
  }
})

// Single-appointment route: defined after admin '/patients' to avoid route collisions
router.get('/:id', protect, async (req, res) => {
  try {
    const appt = await req.db(Appointment).findById(req.params.id)
      .populate('doctor', 'name email role')
      .populate({ path: 'patient', select: 'firstName lastName email phone medicalHistory digitalReports avatarUrl' })
    if (!appt) return res.status(404).json({ error: 'Not found' })

    // If appointment is not linked to a patient document but has an email, try best-effort lookup
    if (!appt.patient && appt.patientEmail) {
      try {
        const p = await req.db(Patient).findOne({ email: appt.patientEmail }).select('firstName lastName email phone medicalHistory digitalReports avatarUrl')
        if (p) appt.patient = p
      } catch (e) { }
    }

    // Authorization: allow doctor (only the assigned doctor), admin, or the owning patient
    const user = req.userId ? await User.findById(req.userId).select('role email') : null
    const isAdmin = user && user.role === 'admin'
    const isDoctor = user && user.role === 'doctor' && String(appt.doctor._id || appt.doctor) === String(req.userId)
    // Determine if the authenticated user is the owning patient (by linked user id or patient email)
    let isPatientOwner = false
    if (user && user.role === 'patient') {
      if (appt.patientUser && String(appt.patientUser) === String(req.userId)) {
        isPatientOwner = true
      } else if (user.email && appt.patientEmail && String(user.email).toLowerCase() === String(appt.patientEmail).toLowerCase()) {
        isPatientOwner = true
      }
    }

    // Permit if admin, assigned doctor, or the owning patient
    if (!(isAdmin || isDoctor || isPatientOwner)) {
      return res.status(403).json({ error: 'Forbidden' })
    }

    res.json(appt)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Server error' })
  }
})

export default router
// The routes below must be registered before export; keep definitions above.
