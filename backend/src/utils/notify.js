import { addNotificationJob } from '../queues/notificationQueue.js'
import * as direct from './notifyDirect.js'

export async function sendEmail(to, subject, html, extra = {}) {
  try {
    await addNotificationJob('email', { to, subject, html, extra })
    console.log('[notify] Email job enqueued in background')
    return { ok: true, queued: true }
  } catch (err) {
    console.warn('[notify] Queue error, sending email directly:', err.message)
    return await direct.sendEmail(to, subject, html, extra)
  }
}

export async function sendSMS(to, body) {
  try {
    await addNotificationJob('sms', { to, body })
    console.log('[notify] SMS job enqueued in background')
  } catch (err) {
    console.warn('[notify] Queue error, sending SMS directly:', err.message)
    await direct.sendSMS(to, body)
  }
}

export async function sendWhatsApp(to, body) {
  try {
    await addNotificationJob('whatsapp', { to, body })
    console.log('[notify] WhatsApp job enqueued in background')
  } catch (err) {
    console.warn('[notify] Queue error, sending WhatsApp directly:', err.message)
    await direct.sendWhatsApp(to, body)
  }
}

export async function sendWhatsAppTemplate(to, contentSid, variables = {}) {
  try {
    await addNotificationJob('whatsappTemplate', { to, contentSid, variables })
    console.log('[notify] WhatsApp template job enqueued in background')
  } catch (err) {
    console.warn('[notify] Queue error, sending WhatsApp template directly:', err.message)
    await direct.sendWhatsAppTemplate(to, contentSid, variables)
  }
}
