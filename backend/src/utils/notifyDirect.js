import fs from 'fs'
import { promises as fsp } from 'fs'
import path from 'path'
import nodemailer from 'nodemailer'
import dns from 'dns'

dns.setDefaultResultOrder('ipv4first')

let smsClient = null

// Nodemailer transporter (created per-send to allow env changes without restart)
function createTransporter() {
  const smtpUser = process.env.SMTP_USER
  const smtpPass = process.env.SMTP_PASS
  const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com'
  const smtpPort = Number(process.env.SMTP_PORT || 465)

  if (!smtpUser || !smtpPass) {
    return null
  }

  return nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: { user: smtpUser, pass: String(smtpPass).replace(/\s+/g, '') },
    tls: { rejectUnauthorized: false },
    family: 4 // Force IPv4 to prevent ENETUNREACH on some hosts
  })
}

// Initialize Twilio for SMS/WhatsApp
try {
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
    import('twilio').then(twilioMod => {
      const twilioFactory = twilioMod.default || twilioMod
      smsClient = twilioFactory(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
    }).catch(e => console.warn('[notifyDirect] twilio not available; SMS/WhatsApp disabled'))
  }
} catch (e) {
  console.warn('[notifyDirect] twilio init failed; disabled', e?.message || String(e))
}

function normalizePhone(to) {
  if (!to) return to
  let s = String(to).trim()
  if (s.toLowerCase().startsWith('whatsapp:')) {
    s = s.slice('whatsapp:'.length)
  }
  if (s.startsWith('+')) {
    s = '+' + s.slice(1).replace(/\D/g, '')
    return s
  }
  s = s.replace(/\D/g, '')
  const cc = process.env.DEFAULT_COUNTRY_CODE || ''
  if (!cc) return s
  const ccClean = cc.startsWith('+') ? cc : `+${cc}`
  const digits = s.replace(/^0+/, '')
  return `${ccClean}${digits}`
}

async function saveFailedEmailToOutbox({ to, subject, html, extra, error, provider, statusCode = null }) {
  try {
    const outboxDir = path.join(process.cwd(), 'uploads', 'email-outbox')
    await fsp.mkdir(outboxDir, { recursive: true })
    const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.json`
    const full = path.join(outboxDir, name)
    const payload = {
      to,
      subject,
      html,
      extra,
      error,
      provider,
      statusCode,
      date: new Date().toISOString()
    }
    await fsp.writeFile(full, JSON.stringify(payload, null, 2), 'utf8')
    console.warn(`[notifyDirect] saved failed email to ${full}`)
    return full
  } catch (e) {
    console.error('[notifyDirect] failed to save email outbox:', e?.message || String(e))
    return null
  }
}

// Check if SMTP is configured
function isSMTPConfigured() {
  return !!(process.env.SMTP_USER && process.env.SMTP_PASS)
}

export async function sendEmail(to, subject, html, extra = {}) {
  if (!to) return { ok: false, provider: 'none', error: 'no-recipient', errorCode: 'NO_RECIPIENT', retryable: false }

  // ─── PRIMARY: Send via SMTP (Nodemailer) ───────────────────────────
  if (process.env.NODE_ENV !== 'production' && isSMTPConfigured()) {
    try {
      const transporter = createTransporter()
      if (transporter) {
        const fromName = process.env.COMPANY_NAME || 'HMS'
        const fromEmail = process.env.FROM_EMAIL || process.env.SMTP_USER
        const mailOptions = {
          from: `"${fromName}" <${fromEmail}>`,
          to: Array.isArray(to) ? to.join(',') : to,
          subject,
          html,
          cc: extra.cc,
          bcc: extra.bcc,
          replyTo: extra.replyTo || process.env.REPLY_TO || fromEmail,
        }

        if (extra.attachments && Array.isArray(extra.attachments)) {
          mailOptions.attachments = extra.attachments.map(att => {
            const out = { filename: att.filename || att.name || 'attachment' }
            if (att.path) out.path = att.path
            else if (att.content) out.content = att.content
            if (att.cid) out.cid = att.cid
            if (att.contentType) out.contentType = att.contentType
            return out
          })
        }

        const info = await transporter.sendMail(mailOptions)
        console.log('[notifyDirect] SMTP email sent:', info.messageId)
        return { ok: true, provider: 'smtp', info }
      }
    } catch (err) {
      console.error('[notifyDirect] SMTP send failed, trying SendGrid fallback:', err?.message || err)
    }
  } else {
    console.warn('[notifyDirect] SMTP not configured. Falling back to SendGrid.')
  }

  // ─── FALLBACK: Send via SendGrid ──────────────────────────────────────────
  if (SENDGRID_API_KEY && SENDGRID_API_KEY !== 'SG.dummy') {
    return await sendViaSendGrid(to, subject, html, extra)
  }

  console.error('[notifyDirect] No email transport configured or all failed.')
  const savedTo = await saveFailedEmailToOutbox({ to, subject, html, extra, error: 'no-transport-available', provider: 'none', statusCode: 'NO_TRANSPORT' })
  return { ok: false, provider: 'none', error: 'No transport available', errorCode: 'NO_TRANSPORT', retryable: false, savedTo }
}

// ─── SendGrid sender ────────────────────────────────────────────────
import sgMail from '@sendgrid/mail'

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY
if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY)
}

async function sendViaSendGrid(to, subject, html, extra = {}) {
  try {
    const fromName = process.env.COMPANY_NAME || 'HMS'
    const fromEmail = process.env.FROM_EMAIL || process.env.SMTP_USER || 'admin@pharmaplus.local'
    const replyTo = process.env.REPLY_TO || fromEmail

    const msg = {
      to: Array.isArray(to) ? to : [to],
      from: {
        email: fromEmail,
        name: fromName
      },
      replyTo,
      subject,
      html,
    }

    if (extra.cc) msg.cc = Array.isArray(extra.cc) ? extra.cc : [extra.cc]
    if (extra.bcc) msg.bcc = Array.isArray(extra.bcc) ? extra.bcc : [extra.bcc]

    // Handle attachments
    if (extra.attachments && Array.isArray(extra.attachments)) {
      msg.attachments = extra.attachments.map(att => {
        let content = ''
        if (att.path && fs.existsSync(att.path)) {
          content = fs.readFileSync(att.path).toString('base64')
        } else if (att.content) {
          content = typeof att.content === 'string' && att.content.includes('base64')
            ? att.content.replace(/^data:.*\/.*;base64,/, '')
            : Buffer.from(att.content).toString('base64')
        }

        if (content) {
          const mType = att.filename && att.filename.endsWith('.pdf') ? 'application/pdf' : 'image/png'
          return {
            content,
            filename: att.filename || att.name || 'attachment',
            type: att.contentType || mType,
            disposition: 'attachment',
            content_id: att.cid || undefined
          }
        }
        return null
      }).filter(Boolean)
    }

    const [response] = await sgMail.send(msg)
    console.log('[notifyDirect] SendGrid email sent, status:', response.statusCode)
    return { ok: true, provider: 'sendgrid', info: response }
  } catch (err) {
    console.error('[notifyDirect] SendGrid send failed:', err?.response?.body || err?.message || err)
    const errMessage = err?.response?.body ? JSON.stringify(err.response.body) : (err.message || String(err))
    const savedTo = await saveFailedEmailToOutbox({ to, subject, html, extra, error: errMessage, provider: 'sendgrid', statusCode: 'SENDGRID_ERROR' })
    return { ok: false, provider: 'sendgrid', error: errMessage, errorCode: 'SENDGRID_ERROR', retryable: true, savedTo }
  }
}

export async function sendSMS(to, body) {
  if (!to) return
  if (!smsClient || !process.env.TWILIO_FROM) {
    console.log('[notifyDirect] sms (noop):', { to, reason: !smsClient ? 'no twilio client' : 'TWILIO_FROM missing' })
    return
  }
  try {
    const toNum = normalizePhone(to)
    await smsClient.messages.create({ from: process.env.TWILIO_FROM, to: toNum, body })
  } catch (err) {
    console.error('[notifyDirect] sms error:', err?.code || '', err?.message || err)
    throw err
  }
}

export async function sendWhatsApp(to, body) {
  if (!to) return
  if (!smsClient || !process.env.TWILIO_WHATSAPP_FROM) {
    console.log('[notifyDirect] whatsapp (noop):', { to, reason: !smsClient ? 'no twilio client' : 'TWILIO_WHATSAPP_FROM missing' })
    return
  }
  const norm = normalizePhone(to)
  const toAddr = norm.startsWith('whatsapp:') ? norm : `whatsapp:${norm}`
  try {
    await smsClient.messages.create({ from: process.env.TWILIO_WHATSAPP_FROM, to: toAddr, body })
  } catch (err) {
    console.error('[notifyDirect] whatsapp error:', err?.code || '', err?.message || err)
    throw err
  }
}

export async function sendWhatsAppTemplate(to, contentSid, variables = {}) {
  if (!to || !contentSid) return
  if (!smsClient || !process.env.TWILIO_WHATSAPP_FROM) {
    console.log('[notifyDirect] whatsapp template (noop):', { to, reason: !smsClient ? 'no twilio client' : 'TWILIO_WHATSAPP_FROM missing' })
    return
  }
  const norm = normalizePhone(to)
  const toAddr = norm.startsWith('whatsapp:') ? norm : `whatsapp:${norm}`
  try {
    await smsClient.messages.create({
      from: process.env.TWILIO_WHATSAPP_FROM,
      to: toAddr,
      contentSid,
      contentVariables: JSON.stringify(variables)
    })
  } catch (err) {
    console.error('[notifyDirect] whatsapp template error:', err?.code || '', err?.message || err)
    throw err
  }
}
