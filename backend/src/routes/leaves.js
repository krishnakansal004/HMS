import express from 'express';
import LeaveRequest from '../models/LeaveRequest.js';
import { protect, admin } from '../utils/auth.js';
import { allowRolesWithSubadminFeature } from '../utils/permissions.js';
import tenantMiddleware from '../utils/tenant.js';
import DoctorAvailability from '../models/DoctorAvailability.js';
import Appointment from '../models/Appointment.js';
import User from '../models/User.js';
import { sendEmail, sendSMS, sendWhatsApp } from '../utils/notify.js';
import { appointmentCancellationTemplate } from '../utils/emailTemplates.js';
import { istDateString } from '../utils/ist.js';
import { getCache, setCache } from '../utils/redis.js';

const router = express.Router();

// List leaves (filter by staff or status)
router.get('/', protect, tenantMiddleware, async (req, res) => {
  const { staffId, doctorId, status } = req.query;
  const q = { };
  if (staffId) q.staff = staffId;
  if (doctorId) q.doctor = doctorId;
  if (status) q.status = status;
  const tenantId = req.tenant?._id || req.user?.tenantId
  const cacheKey = `hms:leaves:list:${tenantId}:${staffId || ''}:${doctorId || ''}:${status || ''}`
  const cached = await getCache(cacheKey)
  if (cached) {
    return res.json(cached)
  }

  const list = await req.db(LeaveRequest).find(q)
    .populate('staff','name role')
    .populate('doctor','name email role')
    .populate('approvedBy','name');
  await setCache(cacheKey, list, 30).catch(() => {})
  res.json(list);
});

// Create leave request (staff)
router.post('/', protect, tenantMiddleware, async (req, res) => {
  const staff = req.body.staff || req.body.staffId || null;
  const doctor = req.body.doctor || req.body.doctorId || null;
  const { startDate, endDate, type, reason } = req.body;
  if ((!staff && !doctor) || !startDate || !endDate || !type) return res.status(400).json({ error: 'Missing fields' });
  const lr = await req.db(LeaveRequest).create({ staff: staff || undefined, doctor: doctor || undefined, startDate, endDate, type, reason, status: 'pending' });
  res.status(201).json(lr);
});

// Approve / reject (admin/subadmin with permission)
router.patch('/:id', protect, tenantMiddleware, allowRolesWithSubadminFeature(['admin','director','subadmin'], 'manage_leaves'), async (req, res) => {
  const lr = await req.db(LeaveRequest).findOne({ _id: req.params.id, });
  if (!lr) return res.status(404).json({ error: 'Not found' });
  if (req.body.status && ['approved','rejected'].includes(req.body.status)) {
    const note = req.body.reviewNote || req.body.note || 'Processed by admin'
    lr.status = req.body.status;
    lr.reviewNote = note.trim();
    lr.approvedBy = req.userId;
    await lr.save();

    // On approval for a doctor: block availability (exceptions) and cancel appointments with notifications
    if (lr.status === 'approved' && lr.doctor) {
      const doctorId = String(lr.doctor)
      // 1) Upsert availability exceptions for each date in range
      let avail = await req.db(DoctorAvailability).findOne({ doctor: doctorId, })
      if (!avail) avail = await req.db(DoctorAvailability).create({ doctor: doctorId })
      const start = new Date(lr.startDate); const end = new Date(lr.endDate)
      const toAdd = []
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const ymd = new Date(d.getTime()); ymd.setHours(0,0,0,0)
        const ymdStr = istDateString(ymd)
        if (!avail.exceptions.find(e => e.date === ymdStr)) {
          toAdd.push({ date: ymdStr, reason: 'Approved leave' })
        }
      }
      if (toAdd.length) {
        avail.exceptions = [...(avail.exceptions || []), ...toAdd]
        await avail.save()
      }

      // 2) Cancel all non-cancelled appointments in the date range and notify patients
      const dayStart = new Date(lr.startDate); dayStart.setHours(0,0,0,0)
      const dayEnd = new Date(lr.endDate); dayEnd.setHours(0,0,0,0); dayEnd.setDate(dayEnd.getDate() + 1)
      const appts = await req.db(Appointment).find({ doctor: doctorId, date: { $gte: dayStart, $lt: dayEnd }, status: { $ne: 'cancelled' } })
      const docUser = await User.findOne({ _id: doctorId, }, 'name email')
      await Promise.all(appts.map(async (appt) => {
        appt.status = 'cancelled'
        appt.cancellationReason = 'Doctor on approved leave'
        appt.notifications = appt.notifications || {}
        appt.notifications.cancellation = appt.notifications.cancellation || {}
        // Email
        try {
          if (appt.patientEmail) {
            const { html, attachments } = appointmentCancellationTemplate({ appointment: appt, doctor: docUser })
            const subject = `${process.env.COMPANY_NAME || 'PharmaPlus HMS'}: Appointment Cancelled`
            await sendEmail(appt.patientEmail, subject, html, attachments?.length ? { attachments } : undefined)
            appt.notifications.cancellation.emailAt = new Date()
          }
        } catch (_) {}
        // SMS / WhatsApp
        try {
          if (appt.patientPhone) {
            const whenStr = new Date(appt.slotStart).toLocaleString()
            const company = process.env.COMPANY_NAME || 'PharmaPlus'
            const baseMsg = `Your appointment on ${whenStr} with Dr. ${docUser?.name || ''} has been cancelled.`
            await sendSMS(appt.patientPhone, `${company}: ${baseMsg}`)
            appt.notifications.cancellation.smsAt = new Date()
            await sendWhatsApp(appt.patientPhone, `*${company}*\n${baseMsg}\nStatus: Cancelled`).catch(()=>{})
            appt.notifications.cancellation.whatsappAt = new Date()
          }
        } catch (_) {}
        appt.markModified('notifications')
        await appt.save().catch(()=>{})
      }))
    }
  }
  res.json(lr);
});

export default router;
