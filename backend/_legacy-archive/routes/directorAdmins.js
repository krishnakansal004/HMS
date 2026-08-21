import { enforcePlanLimit, loadTenant } from '../utils/saas.js'
import express from 'express'
import User from '../models/User.js'
import { protect, requireRoles } from '../utils/auth.js'
import { allowRolesWithSubadminFeature } from '../utils/permissions.js'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import tenantMiddleware from '../utils/tenant.js'
import DoctorProfile from '../models/DoctorProfile.js'
import Tenant from '../models/Tenant.js'
import QueueToken from '../models/QueueToken.js'
import Prescription from '../models/Prescription.js'
import Invoice from '../models/Invoice.js'
import PaymentRequest from '../models/PaymentRequest.js'
import Patient from '../models/Patient.js'
import Appointment from '../models/Appointment.js'
import Expense from '../models/Expense.js'
import Staff from '../models/Staff.js'
import Attendance from '../models/Attendance.js'
import LeaveRequest from '../models/LeaveRequest.js'
import { sendEmail } from '../utils/notify.js'
import { buildPublicFrontendUrl } from '../utils/publicUrl.js'
import { planRequestApprovedTemplate, passwordResetTemplate, invoicePaidTemplate } from '../utils/emailTemplates.js'
import PlanReceipt from '../models/PlanReceipt.js'
import { provisionTenantForInvoice } from '../services/provisionTenant.js'
import { queueCredentialsEmailJob, updateInvoiceCredentialsDelivery, attemptOrQueueCredentialsEmail } from '../utils/emailJobs.js'
import { razorpayInstance, createInvoiceFromPaymentRequest } from './payments.js'

const router = express.Router()

const normalizeEmailInput = (value) => String(value || '').trim().toLowerCase()

function emailLookupCandidates(inputEmail) {
  const email = normalizeEmailInput(inputEmail)
  if (!email || !email.includes('@')) return email ? [email] : []
  const [localRaw, domainRaw] = email.split('@')
  const local = String(localRaw || '').trim()
  const domain = String(domainRaw || '').trim()
  const out = [email]
  if (domain === 'gmail.com' || domain === 'googlemail.com') {
    const localNoPlus = local.split('+')[0]
    const localNoDots = localNoPlus.replace(/\./g, '')
    const variants = [
      `${localNoPlus}@gmail.com`,
      `${localNoDots}@gmail.com`,
      `${localNoPlus}@googlemail.com`,
      `${localNoDots}@googlemail.com`
    ]
    for (const v of variants) {
      if (!out.includes(v)) out.push(v)
    }
  }
  return out
}

async function findUserByEmailFlexible(inputEmail) {
  const candidates = emailLookupCandidates(inputEmail)
  const users = await User.find({ email: { $in: candidates } })
  for (const candidate of candidates) {
    const user = users.find(u => u.email === candidate)
    if (user) return user
  }
  return null
}

function sendMailInBackground(taskLabel, fn) {
  Promise.resolve()
    .then(fn)
    .catch((err) => {
      console.warn(`[director/admins] ${taskLabel} failed:`, err?.message || err)
    })
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, Number(ms) || 0))

async function sendEmailWithRetry({ to, subject, html, extra = {} }, {
  attempts = Number(process.env.DIRECTOR_MAIL_RETRY_ATTEMPTS || 3),
  baseDelayMs = Number(process.env.DIRECTOR_MAIL_RETRY_BASE_MS || 3000),
  taskLabel = 'email'
} = {}) {
  let lastResult = null
  for (let i = 1; i <= Math.max(1, attempts); i += 1) {
    lastResult = await sendEmail(to, subject, html, extra)
    if (lastResult?.ok) return lastResult
    const errCode = String(lastResult?.errorCode || lastResult?.error || 'unknown')
    console.warn('[director/admins] email attempt failed', { taskLabel, to, attempt: i, errorCode: errCode })
    if (i < attempts) {
      await sleep(baseDelayMs * i)
    }
  }
  return lastResult
}

// GET /api/director/admins?q=search
// Returns array of admin users (safe fields only)
router.get('/admins', protect, tenantMiddleware, allowRolesWithSubadminFeature(['director', 'admin', 'subadmin'], 'view_admins'), async (req, res) => {
  try {
    const q = (req.query.q || '').trim()
    // Directors: see all admins across tenants. Non-director roles: scoped to own tenant.
    const filter = { role: 'admin' }
    if (req.userRole !== 'director' && req.tenantId) filter.tenantId = req.tenantId
    let users = await User.find(filter)
      .select('name email phone locale createdAt updatedAt blocked tenantId role pendingInvoiceId')
      .populate({ path: 'tenantId', select: 'name plan', populate: { path: 'plan', select: 'name' } })
      .sort({ createdAt: -1 })
      .limit(1000)

    // Firestore wrapper does not support regex+$or reliably; apply search in-memory.
    if (q) {
      const needle = String(q).toLowerCase()
      users = users.filter((u) => (
        String(u.name || '').toLowerCase().includes(needle) ||
        String(u.email || '').toLowerCase().includes(needle) ||
        String(u.phone || '').toLowerCase().includes(needle)
      ))
    }

    const pendingInvoiceIds = Array.from(new Set(
      users.map(u => String(u.pendingInvoiceId || '')).filter(Boolean)
    ))
    const paymentLinkByInvoice = {}
    if (pendingInvoiceIds.length) {
      try {
        const prs = await PaymentRequest.find({ invoice: { $in: pendingInvoiceIds } }).limit(2000)
        const syncPromises = []
        for (const pr of prs || []) {
          const invId = String(pr.invoice || '')
          if (!invId) continue
          paymentLinkByInvoice[invId] = pr?.razorpay?.shortUrl || null

          // Sync pending status with Razorpay
          if (pr?.razorpay?.linkId && pr.status !== 'paid' && razorpayInstance) {
            syncPromises.push((async () => {
              try {
                console.log(`[director/admins] Syncing Razorpay link: ${pr.razorpay.linkId} for invoice: ${invId}`)
                const link = await razorpayInstance.paymentLink.fetch(pr.razorpay.linkId)
                if (link && link.status === 'paid') {
                  console.log(`[director/admins] Auto-syncing paid link ${link.id} for user activation`)
                  await createInvoiceFromPaymentRequest(pr, link, link.payments?.[0])
                  
                  // Update the user object in memory so the response reflects the active status
                  const uIndex = users.findIndex(u => String(u.pendingInvoiceId) === invId)
                  if (uIndex !== -1) {
                    users[uIndex].blocked = false
                    users[uIndex].pendingInvoiceId = null
                  }
                }
              } catch (err) {
                console.warn('[director/admins] Auto-sync payment failed for', pr.razorpay.linkId, err?.message || err)
              }
            })())
          } else if (pr.status === 'paid') {
            const uIndex = users.findIndex(u => String(u.pendingInvoiceId) === invId)
            if (uIndex !== -1 && users[uIndex].blocked) {
              console.log(`[director/admins] pr matches paid status but user remains blocked... Fixing user ${users[uIndex]._id}.`)
              syncPromises.push((async () => {
                await User.update(users[uIndex]._id, { blocked: false, pendingInvoiceId: null })
                users[uIndex].blocked = false
                users[uIndex].pendingInvoiceId = null
              })())
            }
          }
        }
        await Promise.all(syncPromises)
      } catch (e) {
        console.warn('[director/admins] failed to resolve pending payment links:', e?.message || e)
      }
    }

    const out = users.map(u => {
      let hName = process.env.COMPANY_NAME || 'HOSPITECHVERSE'
      if (u.tenantId && u.tenantId.name) hName = u.tenantId.name

      return {
        id: u._id,
        name: u.name,
        email: u.email,
        phone: u.phone || '',
        tenant: u.tenantId ? { id: u.tenantId._id, name: u.tenantId.name } : null,
        plan: (u.tenantId && u.tenantId.plan) ? { id: u.tenantId.plan._id, name: u.tenantId.plan.name } : null,
        hospitalName: hName,
        password: '••••••',
        blocked: !!u.blocked,
        paymentPending: Boolean(u.blocked && u.pendingInvoiceId),
        pendingInvoiceId: u.pendingInvoiceId ? String(u.pendingInvoiceId) : null,
        paymentShortUrl: u.pendingInvoiceId ? (paymentLinkByInvoice[String(u.pendingInvoiceId)] || null) : null,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt
      }
    })

    res.json(out)
  } catch (e) {
    console.error('director admins error', e)
    res.status(500).json({ error: 'Failed to fetch admins' })
  }
})

// POST /api/director/admins - Create a new admin user (director only)
// Accepts: name, email, phone, hospitalName, planId, period, requestedAmount
// Flow: create user (pending) → create invoice → create Razorpay payment link → email payment link to admin
router.post('/admins', protect, tenantMiddleware, requireRoles('director'), enforcePlanLimit('admins'), async (req, res) => {
  try {
    const { name, email, phone, hospitalName, planId, period, requestedAmount } = req.body || {}
    if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' })
    if (!email || !email.trim()) return res.status(400).json({ error: 'Email is required' })

    const normalizedEmail = normalizeEmailInput(email)
    const normalizedPhone = String(phone || '').trim()

    console.log('[director/admins] Attempting to create admin:', { name, email: normalizedEmail, hospitalName })

    // 1. Check for duplicate email or phone (Flexible check for Gmail etc)
    let existing = await findUserByEmailFlexible(normalizedEmail)
    if (!existing && normalizedPhone) {
      existing = await User.findOne({ phone: normalizedPhone })
    }

    if (existing) {
      console.log('[director/admins] Conflict: Account already exists', { email: existing.email, role: existing.role })
      let paymentShortUrl = null
      let paymentLinkId = null
      if (existing.role === 'admin' && existing.pendingInvoiceId) {
        try {
          const pr = await PaymentRequest.findOne({ invoice: String(existing.pendingInvoiceId) })
          if (pr?.razorpay?.shortUrl) paymentShortUrl = pr.razorpay.shortUrl
          if (pr?.razorpay?.linkId) paymentLinkId = pr.razorpay.linkId
        } catch (e) {
          console.warn('[director/admins] existing user payment link lookup failed:', e?.message || e)
        }
      }

      const isAdmin = existing.role === 'admin'
      const isPending = isAdmin && !!existing.pendingInvoiceId
      return res.status(409).json({
        error: isPending
          ? `An admin account with this ${existing.email === normalizedEmail ? 'email' : 'phone number'} already exists and is pending payment.`
          : isAdmin
            ? `An admin account with this ${existing.email === normalizedEmail ? 'email' : 'phone number'} already exists.`
            : `An account with this ${existing.email === normalizedEmail ? 'email' : 'phone number'} already exists as a ${existing.role}.`,
        code: 'ACCOUNT_EXISTS',
        existingRole: existing.role || null,
        existingBlocked: Boolean(existing.blocked),
        alreadyExists: true,
        paymentShortUrl: paymentShortUrl || null,
        paymentLinkId: paymentLinkId || null,
        invoiceId: existing.pendingInvoiceId ? String(existing.pendingInvoiceId) : null
      })
    }

    // 2. Resolve plan if provided
    let plan = null
    if (planId) {
      const Plan = (await import('../models/Plan.js')).default
      plan = await Plan.findById(planId)
      if (!plan) {
        console.warn('[director/admins] Plan not found:', planId)
        return res.status(404).json({ error: 'Selected plan not found' })
      }
    }

    // 3. Generate a secure random placeholder password
    const placeholderPassword = crypto.randomBytes(32).toString('hex')
    const passwordHash = await bcrypt.hash(placeholderPassword, 10)

    let isBlocked = true
    let setupToken = null
    let hashedSetupToken = null
    let setupUrl = null

    if (!plan) {
      // If no plan, we allow immediate setup
      isBlocked = false
      setupToken = crypto.randomBytes(32).toString('hex')
      hashedSetupToken = crypto.createHash('sha256').update(setupToken).digest('hex')
      setupUrl = `${buildPublicFrontendUrl('/reset-password')}?token=${setupToken}&email=${encodeURIComponent(normalizedEmail)}`
    }

    // 4. Create the admin user (inactive until payment confirmed)
    console.log('[director/admins] Creating user document...')
    const newUser = await User.create({
      name: String(name).trim(),
      email: normalizedEmail,
      username: normalizedEmail,
      phone: normalizedPhone || undefined,
      passwordHash,
      role: 'admin',
      mustChangePassword: true,
      blocked: isBlocked,
      passwordResetToken: hashedSetupToken || undefined,
      passwordResetExpires: hashedSetupToken ? new Date(Date.now() + 24 * 60 * 60 * 1000) : undefined,
      joiningDate: new Date().toISOString(),
      createdBy: req.userId
    })
    console.log('[director/admins] User created successfully:', newUser._id)

    // 5. Create Invoice for the plan subscription
    let invoice = null
    let paymentShortUrl = null
    let paymentLinkId = null

    if (plan) {
      const paymentsService = (await import('../services/payments.js')).default
      let amount = paymentsService.computeAmountFromPlan(plan, period || 'monthly', requestedAmount || 0)
      if ((!amount || Number(amount) === 0) && Number(requestedAmount)) amount = Number(requestedAmount)

      if (amount && Number(amount) > 0) {
        console.log('[director/admins] Creating invoice for amount:', amount)
        try {
          const result = await paymentsService.createInvoiceAndPaymentRequest({
            patientName: String(name).trim(),
            items: [{ 
              description: `Plan subscription: ${plan.name} (${period || 'monthly'})`, 
              quantity: 1, 
              unitPrice: Number(amount), // Passed in Rupees
              gstRate: 0 
            }],
            billing: { 
              name: String(name).trim(), 
              email: normalizedEmail, 
              phone: normalizedPhone || '', 
              period: period || 'monthly', 
              company: hospitalName || '' 
            },
            plan,
            createdBy: req.userId,
            createdByRole: 'director',
            tenantId: null,
          })
          
          if (result.error) {
            console.error('[director/admins] Payment link creation returned error:', result.error)
          }

          invoice = result.invoice
          paymentShortUrl = result.paymentShortUrl || null
          paymentLinkId = result.paymentLinkId || null
          
          // Store reference to the invoice on user for later confirmation
          if (invoice?._id) {
            newUser.pendingInvoiceId = String(invoice._id)
            await newUser.save()
            console.log('[director/admins] Updated user with pendingInvoiceId:', invoice._id)
          }
        } catch (invErr) {
          console.error('[director/admins] Invoice creation exception:', invErr)
        }
      } else {
        // Free plan (amount 0) - unblock and provision immediately
        console.log('[director/admins] Free plan detected, auto-provisioning...')
        try {
          // Create a zero-amount invoice first to track the subscription
          invoice = await Invoice.create({
            patientName: String(name).trim(),
            items: [{ description: `Free Plan: ${plan.name}`, quantity: 1, unitPrice: 0, gstRate: 0 }],
            total: 0,
            paid: true,
            paidAt: new Date(),
            paymentMethod: 'free',
            plan: plan._id,
            billing: { email: normalizedEmail, name: String(name).trim(), period: period || 'monthly' },
            createdBy: req.userId,
            createdByRole: 'director'
          })

          const { tenant, user: provisionedUser, presetPassword } = await provisionTenantForInvoice(invoice)
          if (tenant && provisionedUser) {
            // Unblock and update user
            newUser.blocked = false
            newUser.tenantId = tenant._id
            newUser.pendingInvoiceId = null
            await newUser.save()

            // Trigger credentials email
            await attemptOrQueueCredentialsEmail({
              invoice,
              user: provisionedUser,
              tenant,
              presetPassword,
              reason: 'free-plan-auto-provision'
            })
            
            // Mark that we handled this as credentials
            setupUrl = null 
            console.log('[director/admins] Free plan auto-provisioned successfully')
          }
        } catch (provErr) {
          console.error('[director/admins] Free plan auto-provision failed:', provErr)
        }
      }
    }

    // 6. Final response back to frontend
    console.log('[director/admins] Preparing success response', {
      userId: newUser._id,
      hasInvoice: !!invoice,
      hasPaymentLink: !!paymentShortUrl
    })

    const responseBody = {
      id: newUser._id,
      name: newUser.name,
      email: newUser.email,
      phone: newUser.phone || '',
      hospitalName: hospitalName || process.env.COMPANY_NAME || 'HMS',
      plan: plan ? { id: plan._id, name: plan.name } : null,
      period: period || 'monthly',
      blocked: !!newUser.blocked,
      paymentPending: !!plan && !!invoice,
      paymentShortUrl,
      paymentLinkId,
      invoiceId: invoice?._id ? String(invoice._id) : null,
      setupUrl: setupUrl || null,
      createdAt: newUser.createdAt
    }
    res.status(201).json(responseBody)

    // 7. Send payment-link or setup email (non-blocking)
    if (plan && (paymentShortUrl || invoice)) {
      sendMailInBackground('payment email', async () => {
        const planReqLike = {
          _id: newUser._id, // Add ID so template doesn't show 'undefined'
          customerName: String(name).trim(),
          customerEmail: normalizedEmail,
          planName: plan?.name || 'HMS Plan',
          period: period || 'monthly',
          company: hospitalName || '',
          phone: normalizedPhone || '',
        }
        const tpl = planRequestApprovedTemplate(planReqLike, invoice || {}, paymentShortUrl)
        const result = await sendEmailWithRetry({
          to: normalizedEmail,
          subject: `${process.env.COMPANY_NAME || 'HMS'} — Complete Your Payment`,
          html: tpl.html,
          extra: { attachments: tpl.attachments }
        }, { taskLabel: 'payment-link' })
        
        if (!result?.ok) {
          console.warn('[director/admins] payment email not delivered after retries', {
            email: normalizedEmail,
            errorCode: result?.errorCode || result?.error || 'unknown'
          })
        }
      })
    } else if (!plan && setupUrl) {
      sendMailInBackground('setup-link email', async () => {
        const { html, attachments } = passwordResetTemplate(newUser, setupUrl)
        const result = await sendEmailWithRetry({
          to: normalizedEmail,
          subject: `${process.env.COMPANY_NAME || 'HMS'} — Your Account is Ready`,
          html,
          extra: { attachments }
        }, { taskLabel: 'create-admin-reset-link' })
        
        if (!result?.ok) {
          console.warn('[director/admins] setup email not delivered after retries', {
            email: normalizedEmail,
            errorCode: result?.errorCode || result?.error || 'unknown'
          })
        }
      })
    }
  } catch (e) {
    console.error('[director/admins] FATAL Error creating admin:', e)
    res.status(500).json({ 
      error: 'Failed to create admin', 
      message: e.message, 
      stack: process.env.NODE_ENV === 'production' ? undefined : e.stack 
    })
  }
})


// POST /api/director/admins/:id/confirm-paid
// Director manually confirms payment for a pending admin → unblocks + sends credentials email
router.post('/admins/:id/confirm-paid', protect, requireRoles('director'), async (req, res) => {
  const { id } = req.params
  console.log('[confirm-paid] Manual confirmation initiated for admin:', id)
  try {
    const user = await User.findById(id)
    if (!user) {
      console.warn('[confirm-paid] Admin user not found:', id)
      return res.status(404).json({ error: 'Admin account not found' })
    }

    const pendingInvoiceId = user.pendingInvoiceId ? String(user.pendingInvoiceId) : null
    console.log('[confirm-paid] Manually confirming payment for user:', { userId: user._id, email: user.email, pendingInvoiceId });
    
    let invoice = null
    if (pendingInvoiceId) {
      try {
        invoice = await Invoice.findById(pendingInvoiceId)
        if (!invoice) {
          console.warn('[confirm-paid] Pending invoice record not found in database:', pendingInvoiceId);
        }
      } catch (e) {
        console.warn('[confirm-paid] Exception loading pending invoice:', e?.message || e)
      }
    }

    // Mark invoice as paid if we have one
    if (invoice) {
      try {
        invoice.paid = true
        invoice.paidAt = new Date()
        await invoice.save()
      } catch (e) {
        console.warn('[confirm-paid] Could not update invoice paid state', e?.message || e)
      }
    }

    let mailMode = 'reset-link'
    let setupUrl = null
    let activeUser = user

    // Preferred path: provision tenant (if needed) and use resilient credentials queue.
    if (invoice && invoice.plan) {
      try {
        const { tenant, user: provisionedUser, presetPassword } = await provisionTenantForInvoice(invoice)
        if (tenant && provisionedUser) {
          activeUser = provisionedUser
          activeUser.blocked = false;
          activeUser.mustChangePassword = true;
          activeUser.pendingInvoiceId = null;
          await activeUser.save();

          console.log('[confirm-paid] User unblocked and pendingInvoiceId cleared', { userId: activeUser._id });

          invoice.tenant = invoice.tenant || tenant._id
          invoice.credentialsSnapshot = Array.isArray(invoice.credentialsSnapshot) ? invoice.credentialsSnapshot : []
          if (presetPassword) {
            const exists = invoice.credentialsSnapshot.some((snap) => (
              String(snap?.email || '').toLowerCase() === String(activeUser.email || '').toLowerCase() &&
              String(snap?.presetPassword || '') === String(presetPassword)
            ))
            if (!exists) {
              invoice.credentialsSnapshot.push({
                email: activeUser.email,
                role: activeUser.role || 'admin',
                username: activeUser.email,
                presetPassword,
                sentAt: new Date()
              })
            }
          }
          await invoice.save()

          // [FIX] Ensure PlanReceipt is created and receipt email is sent for manual confirmations
          try {
            const receiptData = {
              invoice: invoice._id,
              invoiceNumber: invoice.invoiceNumber,
              plan: invoice.plan || null,
              billing: invoice.billing || {},
              total: invoice.total,
              paidAt: invoice.paidAt || new Date(),
              tenantId: tenant._id || null
            }
            await PlanReceipt.create(receiptData)
            console.log('[confirm-paid] PlanReceipt created for manual payment', { invoiceId: invoice._id })

            const tpl = invoicePaidTemplate(invoice)
            const recipient = (invoice.billing && invoice.billing.email) || activeUser.email
            await sendEmail(recipient, `${process.env.COMPANY_NAME || 'HMS'} — Payment Receipt`, tpl.html, { attachments: tpl.attachments })
          } catch (receiptErr) {
            console.error('[confirm-paid] receipt/email error', receiptErr)
          }

          // Use the centralized job helper for reliable delivery (immediate attempt + queue on fail)
          console.log('[confirm-paid] attempting/queuing credentials email for:', activeUser.email)
          await attemptOrQueueCredentialsEmail({ 
            invoice: invoice, 
            user: activeUser, 
            tenant: tenant, 
            presetPassword, 
            reason: 'manual-confirm-paid' 
          })

          mailMode = 'credentials-queued'
          console.log('[confirm-paid] credentials mail process initiated', {
            invoiceId: String(invoice._id),
            email: activeUser.email
          })
        } else {
          console.warn('[confirm-paid] Provisioning returned no tenant or user', { invoiceId: invoice._id })
        }
      } catch (e) {
        console.error('[confirm-paid] tenant provisioning/credentials queue failed:', e?.message || e)
        // We will fall back to setup-link if mailMode is still reset-link
      }
    } else {
      console.log('[confirm-paid] No plan invoice found for manual confirm; falling back to setup-link', {
        hasInvoice: !!invoice,
        plan: invoice?.plan
      })
    }

    // Fallback path: setup-link mail for records without plan invoice.
    if (mailMode !== 'credentials-queued') {
      const setupToken = crypto.randomBytes(32).toString('hex')
      const hashedSetupToken = crypto.createHash('sha256').update(setupToken).digest('hex')
      activeUser.blocked = false
      activeUser.mustChangePassword = true
      activeUser.pendingInvoiceId = null
      activeUser.passwordResetToken = hashedSetupToken
      activeUser.passwordResetExpires = new Date(Date.now() + 24 * 60 * 60 * 1000)
      await activeUser.save()

      setupUrl = `${buildPublicFrontendUrl('/reset-password')}?token=${setupToken}&email=${encodeURIComponent(activeUser.email)}`
      sendMailInBackground('confirm-paid setup-link email', async () => {
        const { html, attachments } = passwordResetTemplate(activeUser, setupUrl)
        const result = await sendEmailWithRetry({
          to: activeUser.email,
          subject: `${process.env.COMPANY_NAME || 'HMS'} — Your Account is Ready`,
          html,
          extra: { attachments }
        }, { taskLabel: 'confirm-paid-reset-link' })
        console.log('[confirm-paid] reset-link email result:', result)
      })
    }

    res.json({ ok: true, setupUrl, userId: activeUser._id, email: activeUser.email, mailMode })
  } catch (e) {
    console.error('confirm-paid error', e)
    res.status(500).json({ error: 'Failed to confirm payment' })
  }
})

// POST /api/director/admins/:id/reveal
// Generate a password reset link for the admin.
// IMPORTANT: this action creates a password reset token for the user.
router.post('/admins/:id/reveal', protect, tenantMiddleware, allowRolesWithSubadminFeature(['director', 'admin', 'subadmin'], 'reveal_admins'), async (req, res) => {
  try {
    const id = req.params.id
    const user = await User.findById(id)
    if (!user) return res.status(404).json({ error: 'User not found' })
    if (req.tenant && String(user.tenantId) !== String(req.tenant._id) && String(user._id) !== String(req.userId)) {
      return res.status(404).json({ error: 'User not found' })
    }

    // generate a random reset token instead of setting a plain password
    const setupToken = crypto.randomBytes(32).toString('hex');
    const hashedSetupToken = crypto.createHash('sha256').update(setupToken).digest('hex');

    user.passwordResetToken = hashedSetupToken;
    user.passwordResetExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await user.save()

    // Return the setup URL to the caller (director).
    const setupUrl = buildPublicFrontendUrl(`/reset-password?token=${setupToken}&email=${encodeURIComponent(user.email)}`)

    res.json({ setupUrl })
  } catch (e) {
    console.error('reveal password error', e)
    res.status(500).json({ error: 'Failed to generate setup link' })
  }
})

// PUT /api/director/admins/:id
// Update safe admin fields (name, email, phone)
router.put('/admins/:id', protect, tenantMiddleware, allowRolesWithSubadminFeature(['director', 'admin', 'subadmin'], 'manage_admins'), async (req, res) => {
  try {
    const id = req.params.id
    // Fetch user first to validate existence and tenant boundary
    const existingUser = await User.findById(id)
    if (!existingUser) return res.status(404).json({ error: 'User not found' })
    // Directors can manage any admin; non-directors are limited to their own tenant
    if (req.userRole !== 'director' && req.tenant && String(existingUser.tenantId) !== String(req.tenant._id) && String(existingUser._id) !== String(req.userId)) {
      return res.status(404).json({ error: 'User not found' })
    }

    const { name, email, phone } = req.body || {}
    const update = {}
    if (typeof name !== 'undefined') update.name = name
    if (typeof email !== 'undefined') update.email = email
    if (typeof phone !== 'undefined') update.phone = phone
    const user = await User.update(id, update)
    if (!user) return res.status(404).json({ error: 'User not found after update' })

    res.json({ id: user._id, name: user.name, email: user.email, phone: user.phone })
  } catch (e) {
    console.error('update admin error', e)
    res.status(500).json({ error: 'Failed to update admin' })
  }
})

// POST /api/director/admins/:id/block
// Block the admin account and clear session to forcibly log them out
router.post('/admins/:id/block', protect, tenantMiddleware, allowRolesWithSubadminFeature(['director', 'admin', 'subadmin'], 'manage_admins'), async (req, res) => {
  try {
    const id = req.params.id
    const user = await User.findById(id)
    if (!user) return res.status(404).json({ error: 'User not found' })
    // Directors can block any admin across tenants; non-directors limited to own tenant
    if (req.userRole !== 'director' && req.tenant && String(user.tenantId) !== String(req.tenant._id) && String(user._id) !== String(req.userId)) {
      return res.status(403).json({ error: 'Not authorized to block this user' })
    }
    user.blocked = true
    user.sessionId = null
    await user.save()
    console.log(`[BlockAdmin] Blocked admin ${id}`);
    res.json({ ok: true, id: user._id })
  } catch (e) {
    console.error('block admin error', e)
    res.status(500).json({ error: 'Failed to block admin' })
  }
})

// POST /api/director/admins/:id/unblock
// Unblock the admin account
router.post('/admins/:id/unblock', protect, tenantMiddleware, allowRolesWithSubadminFeature(['director', 'admin', 'subadmin'], 'manage_admins'), async (req, res) => {
  try {
    const id = req.params.id
    const user = await User.findById(id)
    if (!user) return res.status(404).json({ error: 'User not found' })
    // Directors can unblock any admin across tenants; non-directors limited to own tenant
    if (req.userRole !== 'director' && req.tenant && String(user.tenantId) !== String(req.tenant._id) && String(user._id) !== String(req.userId)) {
      return res.status(403).json({ error: 'Not authorized to unblock this user' })
    }
    user.blocked = false
    await user.save()
    console.log(`[UnblockAdmin] Unblocked admin ${id}`);
    res.json({ ok: true, id: user._id })
  } catch (e) {
    console.error('unblock admin error', e)
    res.status(500).json({ error: 'Failed to unblock admin' })
  }
})

// DELETE /api/director/admins/:id
// Remove the admin user from the system. Ensures tenant boundary checks.
router.delete('/admins/:id', protect, tenantMiddleware, allowRolesWithSubadminFeature(['director', 'admin', 'subadmin'], 'manage_admins'), async (req, res) => {
  try {
    const id = req.params.id
    const user = await User.findById(id)
    if (!user) return res.status(404).json({ error: 'User not found' })
    // Directors can delete any admin across tenants; non-directors limited to own tenant
    if (req.userRole !== 'director' && req.tenant && String(user.tenantId) !== String(req.tenant._id) && String(user._id) !== String(req.userId)) {
      return res.status(403).json({ error: 'Not authorized to delete this user' })
    }

    const ids = [String(id)]
    const email = user.email

    // Attempt cascade deletions individually — failures are logged but do NOT abort user deletion
    try { await DoctorProfile.deleteMany({ user: String(id) }) } catch (e) {
      console.warn(`[DeleteAdmin] DoctorProfile cleanup failed for ${id}:`, e?.message || e)
    }
    try { await QueueToken.deleteMany({ doctor: String(id) }) } catch (e) {
      console.warn(`[DeleteAdmin] QueueToken cleanup failed for ${id}:`, e?.message || e)
    }
    try { await Prescription.deleteMany({ doctor: String(id) }) } catch (e) {
      console.warn(`[DeleteAdmin] Prescription cleanup failed for ${id}:`, e?.message || e)
    }
    try { await Invoice.deleteMany({ doctor: String(id) }) } catch (e) {
      console.warn(`[DeleteAdmin] Invoice(doctor) cleanup failed for ${id}:`, e?.message || e)
    }
    try { await Invoice.deleteMany({ createdBy: String(id) }) } catch (e) {
      console.warn(`[DeleteAdmin] Invoice(createdBy) cleanup failed for ${id}:`, e?.message || e)
    }
    if (email) {
      try { await Patient.deleteMany({ email: email.toLowerCase() }) } catch (e) {
        console.warn(`[DeleteAdmin] Patient cleanup failed for ${email}:`, e?.message || e)
      }
    }

    // Cascade cleanup for Subadmins and related entities created by this admin
    try { await User.deleteMany({ createdBy: String(id) }) } catch (e) {}

    // If this admin owned a tenant, wipe the entire tenant contents
    try {
      const ownedTenants = await Tenant.find({ director: String(id) })
      const deletePromises = ownedTenants.map(async (t) => {
        const tId = t._id || t.id
        console.log(`[DeleteAdmin] Wiping data for tenant ${tId}...`)
        // Clean up all major entities linked to this tenant in parallel
        await Promise.all([
          User.deleteMany({ tenantId: tId }).catch(() => {}),
          Invoice.forHospital(tId).deleteMany({ tenantId: tId }).catch(() => {}),
          Patient.forHospital(tId).deleteMany({ tenantId: tId }).catch(() => {}),
          Appointment.forHospital(tId).deleteMany({ tenantId: tId }).catch(() => {}),
          Expense.forHospital(tId).deleteMany({ tenantId: tId }).catch(() => {}),
          Staff.forHospital(tId).deleteMany({ tenantId: tId }).catch(() => {}),
          Attendance.forHospital(tId).deleteMany({ tenantId: tId }).catch(() => {}),
          LeaveRequest.forHospital(tId).deleteMany({ tenantId: tId }).catch(() => {})
        ])
        // Finally remove the tenant record
        await Tenant.deleteOne(tId).catch(() => {})
      })
      await Promise.all(deletePromises)
    } catch (e) {
      console.warn(`[DeleteAdmin] Tenant-wide cleanup failed for ${id}:`, e?.message || e)
    }

    // Always delete the user document itself — this is the critical step
    await User.deleteOne({ _id: id })
    console.log(`[DeleteAdmin] Successfully deleted admin ${id}.`)
    res.json({ ok: true, deletedUsers: 1, ids: [id] })
  } catch (e) {
    console.error('delete admin error', e)
    res.status(500).json({ error: 'Failed to delete admin' })
  }
})

// GET /api/director/admins/:id/details
// Retrieves specific admin details including plan usage, counts, and URLs.
router.get('/admins/:id/details', protect, tenantMiddleware, async (req, res) => {
  try {
    const id = req.params.id
    const user = await User.findById(id)
    if (!user || user.role !== 'admin') {
      return res.status(404).json({ error: 'Admin not found' })
    }

    // Security layer: enforce tenant scope
    if (req.userRole !== 'director') {
      if (!req.tenantId || String(req.tenantId) !== String(user.tenantId)) {
        return res.status(404).json({ error: 'Admin not found' })
      }
    }

    const tenantId = user.tenantId
    let subscriptionEnd = null
    let slug = null
    let plan = null

    if (tenantId) {
      const Tenant = (await import('../models/Tenant.js')).default
      const tenant = await Tenant.findById(tenantId).populate('plan')
      if (tenant) {
        subscriptionEnd = tenant.subscriptionEnd
        slug = tenant.slug
        plan = tenant.plan
      }
    }

    const Patient = (await import('../models/Patient.js')).default

    // Calculate usage using the target admin's tenant context
    const doctorsCount = tenantId ? await User.countDocuments({ role: 'doctor', tenantId: String(tenantId) }) : 0
    
    // Scoped query for patients. If req.db is missing (Director), use Patient.forHospital(tenantId)
    let patientsCount = 0
    if (tenantId) {
      try {
        const pModel = (req.db && typeof req.db === 'function') ? req.db(Patient) : Patient.forHospital(tenantId)
        patientsCount = await pModel.countDocuments()
      } catch (countErr) {
        console.warn('[get-admin-details] failed to count patients', countErr?.message || countErr)
        // Fallback to 0 or a less accurate count if needed
      }
    }

    res.json({
      id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone || '',
      joiningDate: user.createdAt,
      subscriptionEnd,
      slug,
      publicUrl: slug ? `${(await import('../utils/publicUrl.js')).getPublicFrontendBaseUrl()}/portal/${slug}` : null,
      plan: plan ? {
        id: plan._id,
        name: plan.name,
        limits: plan.limits || { doctors: 0, patients: 0 }
      } : null,
      usage: {
        doctorsCount,
        patientsCount
      }
    })

  } catch (e) {
    console.error('get admin details error', e)
    res.status(500).json({ error: 'Failed to fetch admin details' })
  }
})

// Note: blocking/deleting/changing plan endpoints can be added as needed.

export default router
