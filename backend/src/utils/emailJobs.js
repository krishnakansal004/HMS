import { db } from '../config/firebase.js'
import bcrypt from 'bcryptjs'
import EmailJob from '../models/EmailJob.js'
import Invoice from '../models/Invoice.js'
import User from '../models/User.js'
import Tenant from '../models/Tenant.js'
import { sendEmail } from './notify.js'
import { credentialsProvisionedTemplate } from './emailTemplates.js'
import { buildPublicFrontendUrl } from './publicUrl.js'

const EMAIL_JOB_KIND = 'credentials'
const EMAIL_JOB_LOCK_TTL_MS = Number(process.env.EMAIL_JOB_LOCK_TTL_MS || 2 * 60 * 1000)
const EMAIL_JOB_MAX_DELAY_MS = Number(process.env.EMAIL_JOB_MAX_DELAY_MS || 15 * 60 * 1000)

function genPresetPassword() {
  const words = ['Health', 'Care', 'Med', 'Life', 'Plus', 'Well', 'Safe']
  const numbers = Math.floor(1000 + Math.random() * 9000)
  const word = words[Math.floor(Math.random() * words.length)]
  return `${word}@${numbers}`
}

function baseDelayMs() {
  return Number(process.env.EMAIL_JOB_BASE_DELAY_MS || 5000)
}

function maxAttempts() {
  return Number(process.env.EMAIL_JOB_MAX_ATTEMPTS || 8)
}

function retryDelayMs(currentAttempt) {
  const raw = baseDelayMs() * Math.pow(2, Math.max(0, currentAttempt - 1))
  return Math.min(raw, EMAIL_JOB_MAX_DELAY_MS)
}

function mailErrorString(result) {
  if (!result) return 'unknown'
  if (typeof result === 'string') return result
  if (result.error) return String(result.error)
  if (result.message) return String(result.message)
  return 'unknown'
}

export function summarizeCredentialsDelivery(invoice, job = null) {
  const invState = invoice?.credentialsDelivery || {}
  const status = invState.status || job?.status || 'unknown'
  return {
    invoiceId: String(invoice?._id || ''),
    status,
    attempts: Number(invState.attempts || job?.attempts || 0),
    lastError: invState.lastError || job?.lastError || null,
    nextAttemptAt: invState.nextAttemptAt || job?.nextAttemptAt || null,
    email: invState.email || job?.email || invoice?.billing?.email || null,
    jobId: job && ['pending', 'processing'].includes(job.status) ? String(job._id || job.id || '') : null
  }
}

export async function updateInvoiceCredentialsDelivery(invoiceOrId, patch = {}) {
  const inv = typeof invoiceOrId === 'string' ? await Invoice.findById(invoiceOrId) : invoiceOrId
  if (!inv) return null
  const prev = inv.credentialsDelivery || {}
  inv.credentialsDelivery = {
    ...prev,
    ...patch,
    updatedAt: new Date()
  }
  await inv.save()
  return inv
}

async function findActiveJob(invoiceId, email) {
  const rows = await EmailJob.find({ invoiceId: String(invoiceId) }).limit(80)
  const normalized = rows.filter(r => String(r.kind || '') === EMAIL_JOB_KIND && String(r.email || '').toLowerCase() === String(email || '').toLowerCase())
  const pending = normalized.find(r => r.status === 'pending')
  if (pending) return pending
  const processing = normalized.find(r => r.status === 'processing')
  if (processing) return processing
  return null
}

export async function queueCredentialsEmailJob({
  invoiceId,
  tenantId = null,
  userId = null,
  email,
  attempts = 0,
  lastError = '',
  nextAttemptAt = new Date(),
  forceReset = false
}) {
  if (!invoiceId || !email) return null
  const max = maxAttempts()
  const active = await findActiveJob(invoiceId, email)
  if (active) {
    if (forceReset) {
      active.attempts = Number(attempts || 0)
      active.lastError = lastError || ''
    } else {
      active.attempts = Number(attempts || active.attempts || 0)
      active.lastError = lastError || active.lastError || ''
    }
    active.kind = EMAIL_JOB_KIND
    active.status = 'pending'
    active.maxAttempts = Number(active.maxAttempts || max)
    active.invoiceId = String(invoiceId)
    active.tenantId = tenantId || active.tenantId || null
    active.userId = userId || active.userId || null
    active.email = email
    active.nextAttemptAt = nextAttemptAt
    active.lockedAt = null
    await active.save()
    return active
  }

  return EmailJob.create({
    kind: EMAIL_JOB_KIND,
    invoiceId: String(invoiceId),
    tenantId: tenantId || null,
    userId: userId || null,
    email,
    status: 'pending',
    attempts: Number(attempts || 0),
    maxAttempts: max,
    nextAttemptAt,
    lockedAt: null,
    lastError: lastError || ''
  })
}

export async function getLatestCredentialsJob(invoiceId, email = '') {
  if (!invoiceId) return null
  const rows = await EmailJob.find({ invoiceId: String(invoiceId) }).limit(100)
  const typedRows = rows.filter(r => String(r.kind || '') === EMAIL_JOB_KIND)
  const filtered = email ? typedRows.filter(r => String(r.email || '').toLowerCase() === String(email || '').toLowerCase()) : typedRows
  if (!filtered.length) return null
  return filtered.sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0))[0]
}

async function ensurePresetPassword({ invoice, user, presetPassword = null }) {
  const provided = String(presetPassword || '').trim()
  if (provided) return provided

  const snapshots = Array.isArray(invoice?.credentialsSnapshot) ? invoice.credentialsSnapshot : []
  for (let i = snapshots.length - 1; i >= 0; i -= 1) {
    const snap = snapshots[i] || {}
    if (String(snap.email || '').toLowerCase() === String(user.email || '').toLowerCase()) {
      const snapPwd = String(snap.presetPassword || '').trim()
      if (snapPwd) return snapPwd
    }
  }

  // Legacy/manual resend fallback: rotate a fresh temporary password and persist it before sending mail.
  const generated = genPresetPassword()
  user.passwordHash = await bcrypt.hash(generated, 10)
  user.mustChangePassword = true
  if (!user.username) user.username = user.email
  await user.save()

  invoice.credentialsSnapshot = invoice.credentialsSnapshot || []
  invoice.credentialsSnapshot.push({
    email: user.email,
    role: user.role || 'admin',
    username: user.email,
    presetPassword: generated,
    sentAt: new Date()
  })
  await invoice.save()

  console.log('[mail.credentials] generated fallback preset password for resend', {
    invoiceId: String(invoice._id || ''),
    email: user.email
  })
  return generated
}

export async function sendCredentialsEmailNow({ invoice, user, tenant, presetPassword = null, reason = 'unknown', attempt = 1 }) {
  const started = Date.now()
  try {
    const effectivePassword = await ensurePresetPassword({ invoice, user, presetPassword })
    const credentials = [{ role: user.role || 'admin', username: user.email, password: effectivePassword }]
    const tpl = credentialsProvisionedTemplate(invoice, tenant, credentials)
    const mailResult = await sendEmail(
      user.email,
      `${process.env.COMPANY_NAME || 'HMS'} — Your Account Credentials`,
      tpl.html,
      { attachments: tpl.attachments }
    )

    const elapsedMs = Date.now() - started
    if (mailResult && mailResult.ok) {
      console.log('[mail.credentials] sent', { invoiceId: String(invoice._id), email: user.email, attempt, elapsedMs, reason })
      return { ok: true, mailResult, elapsedMs }
    }

    const errorCode = mailErrorString(mailResult)
    console.warn('[mail.credentials] send failed', { invoiceId: String(invoice._id), email: user.email, attempt, elapsedMs, reason, errorCode })
    return { ok: false, mailResult, elapsedMs, errorCode }
  } catch (err) {
    const elapsedMs = Date.now() - started
    const errorCode = mailErrorString(err)
    console.error('[mail.credentials] send exception', { invoiceId: String(invoice?._id || ''), email: user?.email, attempt, elapsedMs, reason, errorCode })
    return { ok: false, mailResult: null, elapsedMs, errorCode }
  }
}

export async function attemptOrQueueCredentialsEmail({ invoice, user, tenant, presetPassword = null, reason = 'payment' }) {
  if (!invoice || !user || !tenant) return { ok: false, queued: false, errorCode: 'missing-context' }
  const immediateAttempt = Number(invoice?.credentialsDelivery?.attempts || 0) + 1
  const sendRes = await sendCredentialsEmailNow({ invoice, user, tenant, presetPassword, reason, attempt: immediateAttempt })
  const now = new Date()

  if (sendRes.ok) {
    await updateInvoiceCredentialsDelivery(invoice, {
      status: 'sent',
      attempts: immediateAttempt,
      lastError: '',
      lastAttemptAt: now,
      nextAttemptAt: null,
      email: user.email
    })
    // Mark any pending/processing job as sent for this invoice+email.
    const active = await findActiveJob(String(invoice._id), user.email)
    if (active) {
      active.status = 'sent'
      active.lastError = ''
      active.attempts = Number(active.attempts || immediateAttempt)
      active.lockedAt = null
      await active.save()
    }
    return { ok: true, queued: false, ...sendRes }
  }

  const delay = retryDelayMs(immediateAttempt)
  const nextAttemptAt = new Date(Date.now() + delay)
  const job = await queueCredentialsEmailJob({
    invoiceId: String(invoice._id),
    tenantId: tenant?._id || invoice.tenant || invoice.tenantId || null,
    userId: user?._id || null,
    email: user.email,
    attempts: immediateAttempt,
    lastError: sendRes.errorCode || 'smtp-send-failed',
    nextAttemptAt,
    forceReset: false
  })

  await updateInvoiceCredentialsDelivery(invoice, {
    status: 'pending',
    attempts: immediateAttempt,
    lastError: sendRes.errorCode || 'smtp-send-failed',
    lastAttemptAt: now,
    nextAttemptAt,
    email: user.email
  })

  console.warn('[mail.credentials] queued', {
    invoiceId: String(invoice._id),
    email: user.email,
    attempt: immediateAttempt,
    errorCode: sendRes.errorCode || 'smtp-send-failed',
    nextAttemptAt
  })

  return { ok: false, queued: true, job, ...sendRes }
}

async function lockPendingJob(jobId) {
  const ref = db.collection('emailjobs').doc(String(jobId))
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref)
    if (!snap.exists) return null
    const data = snap.data() || {}
    const status = data.status || 'pending'
    const nextAt = data.nextAttemptAt && typeof data.nextAttemptAt.toDate === 'function' ? data.nextAttemptAt.toDate() : new Date(data.nextAttemptAt || 0)
    const lockedAt = data.lockedAt && typeof data.lockedAt.toDate === 'function' ? data.lockedAt.toDate() : (data.lockedAt ? new Date(data.lockedAt) : null)
    const now = new Date()
    const lockExpired = lockedAt ? (now.getTime() - lockedAt.getTime() > EMAIL_JOB_LOCK_TTL_MS) : true
    if (status !== 'pending') return null
    if (nextAt && nextAt > now) return null
    if (!lockExpired) return null

    tx.update(ref, { status: 'processing', lockedAt: now, updatedAt: now })
    return { _id: snap.id, ...data, status: 'processing', lockedAt: now }
  })
}

async function processOneCredentialsJob(job) {
  const attemptNo = Number(job.attempts || 0) + 1
  const max = Number(job.maxAttempts || maxAttempts())
  const now = new Date()

  const inv = await Invoice.findById(job.invoiceId)
  if (!inv) {
    const doc = await EmailJob.findById(job._id)
    if (doc) {
      doc.status = 'failed'
      doc.attempts = attemptNo
      doc.lastError = 'invoice-not-found'
      doc.lockedAt = null
      await doc.save()
    }
    return
  }

  let user = null
  if (job.userId) user = await User.findById(job.userId)
  if (!user && job.email) user = await User.findOne({ email: String(job.email).toLowerCase() })
  if (!user) {
    const doc = await EmailJob.findById(job._id)
    if (doc) {
      doc.status = 'failed'
      doc.attempts = attemptNo
      doc.lastError = 'user-not-found'
      doc.lockedAt = null
      await doc.save()
    }
    await updateInvoiceCredentialsDelivery(inv, {
      status: 'failed',
      attempts: attemptNo,
      lastError: 'user-not-found',
      lastAttemptAt: now,
      nextAttemptAt: null,
      email: job.email || inv.billing?.email || null
    })
    return
  }

  const tenantId = job.tenantId || inv.tenant || inv.tenantId || user.tenantId || null
  const tenant = tenantId ? await Tenant.findById(tenantId) : null
  if (!tenant) {
    const doc = await EmailJob.findById(job._id)
    if (doc) {
      doc.status = 'failed'
      doc.attempts = attemptNo
      doc.lastError = 'tenant-not-found'
      doc.lockedAt = null
      await doc.save()
    }
    await updateInvoiceCredentialsDelivery(inv, {
      status: 'failed',
      attempts: attemptNo,
      lastError: 'tenant-not-found',
      lastAttemptAt: now,
      nextAttemptAt: null,
      email: user.email
    })
    return
  }

  // Get preset password from credentials snapshot if available
  const credSnapshot = (inv.credentialsSnapshot || []).find(c => c.email === user.email)
  const presetPassword = credSnapshot?.presetPassword || null

  const sendRes = await sendCredentialsEmailNow({ invoice: inv, user, tenant, presetPassword, reason: 'job-retry', attempt: attemptNo })
  const doc = await EmailJob.findById(job._id)
  if (!doc) return

  if (sendRes.ok) {
    doc.status = 'sent'
    doc.attempts = attemptNo
    doc.lastError = ''
    doc.lockedAt = null
    await doc.save()
    await updateInvoiceCredentialsDelivery(inv, {
      status: 'sent',
      attempts: attemptNo,
      lastError: '',
      lastAttemptAt: now,
      nextAttemptAt: null,
      email: user.email
    })
    return
  }

  const err = sendRes.errorCode || 'smtp-send-failed'
  const exhausted = attemptNo >= max
  doc.attempts = attemptNo
  doc.lastError = err
  doc.lockedAt = null
  if (exhausted) {
    doc.status = 'failed'
    doc.nextAttemptAt = null
  } else {
    doc.status = 'pending'
    doc.nextAttemptAt = new Date(Date.now() + retryDelayMs(attemptNo))
  }
  await doc.save()

  await updateInvoiceCredentialsDelivery(inv, {
    status: exhausted ? 'failed' : 'pending',
    attempts: attemptNo,
    lastError: err,
    lastAttemptAt: now,
    nextAttemptAt: exhausted ? null : doc.nextAttemptAt,
    email: user.email
  })
}

export async function processDueCredentialEmailJobs({ limit = 10 } = {}) {
  const now = new Date()
  const queued = await EmailJob.find({ status: 'pending' }).limit(Number(limit) * 10)
  const due = queued
    .filter(j => String(j.kind || '') === EMAIL_JOB_KIND)
    .filter(j => !j.nextAttemptAt || new Date(j.nextAttemptAt) <= now)
    .sort((a, b) => new Date(a.nextAttemptAt || 0) - new Date(b.nextAttemptAt || 0))
    .slice(0, Number(limit))

  for (const job of due) {
    try {
      const locked = await lockPendingJob(job._id || job.id)
      if (!locked) continue
      console.log('[mail.job] processing', {
        jobId: String(locked._id || ''),
        invoiceId: String(locked.invoiceId || ''),
        email: locked.email || '',
        attempt: Number(locked.attempts || 0) + 1
      })
      await processOneCredentialsJob(locked)
    } catch (err) {
      console.error('[mail.job] processing error', err?.message || err)
    }
  }
}
