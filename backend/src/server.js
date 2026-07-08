import 'dotenv/config'
import express from 'express'
import { ensureDefaultAdmin } from './utils/bootstrap.js'
import createApp from './app.js'
import Appointment from './models/Appointment.js'
import User from './models/User.js'
import Patient from './models/Patient.js'
import Prescription from './models/Prescription.js'
import { sendEmail, sendSMS, sendWhatsApp, sendWhatsAppTemplate } from './utils/notify.js'
import { processDueCredentialEmailJobs } from './utils/emailJobs.js'

const EXIT_ON_FATAL = String(process.env.EXIT_ON_FATAL || '').toLowerCase() === 'true'

// Global Error Handlers for Production Reloads (e.g. background task failures)
process.on('uncaughtException', (err) => {
  console.error('[CRITICAL] Uncaught Exception:', err)
  if (EXIT_ON_FATAL) process.exit(1)
})

process.on('unhandledRejection', (reason, promise) => {
  console.error('[CRITICAL] Unhandled Rejection at:', promise, 'reason:', reason)
  if (EXIT_ON_FATAL) process.exit(1)
})

const app = createApp()

// Config
const PORT = process.env.PORT || 4000
// CORS is already configured inside createApp(); avoid duplicating here

// DB and start (No longer requires MongoDB uri)
const LISTEN_HOST = process.env.LISTEN_HOST || '0.0.0.0'

// Try listening on the configured port
const server = app.listen(PORT, LISTEN_HOST, () => {
  const addr = server.address()
  let host = addr && addr.address ? addr.address : LISTEN_HOST
  if (host === '::' || host === '::0') host = '0.0.0.0'
  console.log(`Server listening on http://${host}:${addr.port}`)
  if (process.env.FRONTEND_URL) console.log(`Frontend URL (env): ${process.env.FRONTEND_URL}`)
})

server.on('error', (err) => {
  console.error('Server error', err)
})

// Lightweight reminder loop (every 5 minutes)
setInterval(async () => {
  try {
    const now = new Date()
    const in60 = new Date(now.getTime() + 60 * 60000)
    // Firestore in this project may lack composite indexes for status+slotStart queries.
    // Query by status only, then time-filter in-memory to keep the loop stable.
    const scheduled = await Appointment.find({ status: 'scheduled' }).limit(5000)
    const toRemind = (scheduled || []).filter((appt) => {
      const slot = appt?.slotStart ? new Date(appt.slotStart) : null
      if (!slot || Number.isNaN(slot.getTime())) return false
      return !appt.reminderSentAt && slot >= now && slot <= in60
    })
    for (const appt of toRemind) {
      const doctor = await User.findById(appt.doctor)
      const when = new Date(appt.slotStart).toLocaleString()
      const subject = `Reminder: Appointment Token #${appt.tokenNumber}`
      const company = process.env.COMPANY_NAME || 'HMS'
      const logo = process.env.COMPANY_LOGO_URL || ''
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8" />
              <style>body{font-family:Arial,Helvetica,sans-serif;background:#f6f9fc;margin:0;padding:0;color:#334155} .container{max-width:600px;margin:32px auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden} .header{background:#5942ff;color:#ffffff;padding:18px;text-align:center} .logo{max-height:42px;margin-bottom:10px} .content{padding:24px} h1{font-size:19px;margin:0 0 14px;font-weight:600} table{width:100%;border-collapse:collapse;margin:14px 0} td{padding:6px 4px;font-size:13px} .label{color:#64748b;width:130px} .footer{font-size:11px;color:#64748b;padding:14px;background:#f8fafc;text-align:center} .badge{display:inline-block;background:#f59e0b;color:#fff;border-radius:4px;padding:2px 6px;font-size:11px;font-weight:600} a{color:#5942ff;text-decoration:none}</style>
              </head><body><div class="container">
              <div class="header">${logo ? `<img src='${logo}' alt='${company} logo' class='logo' />` : ''}<div style="font-size:20px;font-weight:600">${company}</div></div>
              <div class="content">
              <h1>Appointment Reminder</h1>
              <p>Dear <strong>${appt.patientName}</strong>, this is a friendly reminder of your upcoming appointment.</p>
              <table>
                <tr><td class="label">Doctor</td><td>Dr. ${doctor?.name || ''}</td></tr>
                <tr><td class="label">Time</td><td>${when}</td></tr>
                <tr><td class="label">Token</td><td><span class="badge">#${appt.tokenNumber}</span></td></tr>
                <tr><td class="label">Status</td><td>Scheduled</td></tr>
              </table>
              <p style="margin-top:12px;font-size:13px;color:#64748b">Please arrive a few minutes early. If you can’t attend, let us know to free the slot for another patient.</p>
              </div>
              <div class="footer">&copy; ${new Date().getFullYear()} ${company}. All rights reserved.</div>
              </div></body></html>`
      const msg = `Dear ${appt.patientName}, reminder for your appointment with Dr. ${doctor?.name || ''} at ${when}. Token #${appt.tokenNumber}.`
      const waText = `*${company}*\nAppointment Reminder\n\nPatient: ${appt.patientName}\nDoctor: Dr. ${doctor?.name || ''}\nWhen: ${when}\nToken: #${appt.tokenNumber}\nStatus: Scheduled`
      const reminderTemplate = process.env.TWILIO_WA_CONTENT_SID_REMINDER
      const waTask = reminderTemplate
        ? sendWhatsAppTemplate(appt.patientPhone, reminderTemplate, {
          company,
          patient: appt.patientName,
          doctor: doctor?.name || '',
          when,
          token: `#${appt.tokenNumber}`,
        })
        : sendWhatsApp(appt.patientPhone, waText)
      const tasks = [sendEmail(appt.patientEmail, subject, html), waTask]
      if (process.env.TWILIO_FROM) tasks.push(sendSMS(appt.patientPhone, msg))
      await Promise.allSettled(tasks)
      // Optional: notify doctor about upcoming appointment if enabled
      if (process.env.NOTIFY_DOCTOR_REMINDERS === 'true' && doctor) {
        const dSubject = `Upcoming Appointment ${when} - Token #${appt.tokenNumber}`
        const dMsg = `Reminder: ${appt.patientName} at ${when} (Token #${appt.tokenNumber}).`
        const tasks = []
        if (doctor.email) tasks.push(sendEmail(doctor.email, dSubject, `<p>${dMsg}</p>`))
        if (doctor.phone) {
          tasks.push(sendSMS(doctor.phone, dMsg))
          tasks.push(sendWhatsApp(doctor.phone, dMsg))
        }
        if (tasks.length) {
          await Promise.allSettled(tasks)
        }
      }
      appt.reminderSentAt = new Date()
      await appt.save()
    }
  } catch (e) {
    console.error('reminder loop error', e)
  }
}, 5 * 60 * 1000)

// Credentials email retry worker. This keeps payment flow non-blocking while ensuring eventual delivery attempts.
{
  let running = false
  const JOB_INTERVAL_MS = Number(process.env.EMAIL_JOB_POLL_INTERVAL_MS || 10000)
  const JOB_BATCH = Number(process.env.EMAIL_JOB_BATCH || 10)
  const timer = setInterval(async () => {
    if (running) return
    running = true
    try {
      await processDueCredentialEmailJobs({ limit: JOB_BATCH })
    } catch (e) {
      console.error('[mail.job] worker loop error', e?.message || e)
    } finally {
      running = false
    }
  }, JOB_INTERVAL_MS)
  if (typeof timer.unref === 'function') timer.unref()
}

// Background cache updater loop (every 5 minutes)
{
  let running = false
  const timer = setInterval(async () => {
    if (running) return
    running = true
    try {
      const Tenant = (await import('./models/Tenant.js')).default
      const { updateAllCaches } = await import('./services/cacheService.js')
      const tenants = await Tenant.find({})
      for (const tenant of tenants) {
        if (tenant._id) {
          await updateAllCaches(String(tenant._id)).catch(err => {
            console.error(`[cacheService] Periodic background cache update failed for tenant ${tenant._id}:`, err)
          })
        }
      }
    } catch (e) {
      console.error('[cacheService] Periodic background loop error:', e?.message || e)
    } finally {
      running = false
    }
  }, 5 * 60 * 1000)
  if (typeof timer.unref === 'function') timer.unref()
}

// Start Server
ensureDefaultAdmin()
