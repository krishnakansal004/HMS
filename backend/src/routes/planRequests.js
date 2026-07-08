import express from 'express'
import multer from 'multer'
import fs from 'fs'
import path from 'path'
import PlanRequest from '../models/PlanRequest.js'
import Plan from '../models/Plan.js'
import Invoice from '../models/Invoice.js'
import PaymentRequest from '../models/PaymentRequest.js'
import Razorpay from 'razorpay'
import { sendEmail } from '../utils/notify.js'
import { planRequestReceivedTemplate, planRequestApprovedTemplate, planRequestRejectedTemplate, passwordResetTemplate } from '../utils/emailTemplates.js'
import { provisionTenantForInvoice } from '../services/provisionTenant.js'
import { queueCredentialsEmailJob, updateInvoiceCredentialsDelivery } from '../utils/emailJobs.js'
import { protect, requireRoles } from '../utils/auth.js'
import { istDateString } from '../utils/ist.js'
import paymentsService from '../services/payments.js'
import Tenant from '../models/Tenant.js'

import { uploadPlanRequests, uploadToCloudinary } from '../config/cloudinary.js'

const router = express.Router()

// Storage: save uploaded id docs to Memory
const upload = uploadPlanRequests

// Tenant-initiated renew endpoint: creates invoice + payment link for renewing existing tenant subscription
// Body: { tenantId, period, requestedAmount }
router.post('/renew', protect, async (req, res) => {
  try {
    const { tenantId, period, requestedAmount } = req.body || {}
    if (!tenantId) return res.status(400).json({ error: 'tenantId required' })
    // Only allow tenant users for their own tenant, or director users
    if (req.userRole !== 'director' && String(req.tenantId) !== String(tenantId)) {
      return res.status(403).json({ error: 'Forbidden' })
    }

    const tenant = await Tenant.findById(tenantId)
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' })

    // Resolve plan for tenant
    let plan = null
    if (tenant.plan) plan = await Plan.findById(tenant.plan)

    // If plan is customized, require access code validation
    if (plan && plan.customized) {
      const providedCode = (req.body && (req.body.accessCode || req.body.code)) ? String(req.body.accessCode || req.body.code) : ''
      if (!providedCode) return res.status(400).json({ error: 'Access code required for customized plan' })
      if (!plan.accessCode || String(plan.accessCode).trim() !== String(providedCode).trim()) {
        return res.status(403).json({ error: 'Invalid access code' })
      }
    }

    // Compute amount (in rupees) using helper; for customized plans frontend should supply requestedAmount
    let amount = 0
    if (plan) {
      amount = paymentsService.computeAmountFromPlan(plan, period || 'monthly', requestedAmount || 0)
    }
    if ((!amount || Number(amount) === 0) && Number(requestedAmount)) amount = Number(requestedAmount)
    if (!amount || Number(amount) === 0) return res.status(400).json({ error: 'Unable to compute amount for renewal' })

    // Build invoice items: unitPrice expected in paise
    const itemAmount = Number(amount) // computeAmountFromPlan returns rupees
    const items = [{ description: `Plan renewal: ${plan ? plan.name : 'Subscription'} (${period || 'monthly'})`, quantity: 1, unitPrice: itemAmount, gstRate: 0 }]

    // Determine billing contact: try tenant director user
    let billing = { period: period || 'monthly' }
    try {
      if (tenant && tenant.director) {
        const User = (await import('../models/User.js')).default
        const director = await User.findById(tenant.director).select('name email')
        if (director) billing.name = director.name || ''
        if (director && director.email) billing.email = director.email
      }
    } catch (e) { /* ignore */ }

    const createdBy = req.userId || null
    const createdByRole = req.userRole || 'public'

    // Use payments helper to create invoice + payment request + (attempt) razorpay link
    const result = await paymentsService.createInvoiceAndPaymentRequest({ patientName: billing.name || 'Customer', items, billing, plan: plan || null, createdBy, createdByRole, tenantId: tenant._id })
    // result: { invoice, paymentRequest, paymentShortUrl, paymentLinkId }
    return res.json({ ok: true, invoiceId: result.invoice?._id, paymentRequestId: result.paymentRequest?._id, paymentShortUrl: result.paymentShortUrl, paymentLinkId: result.paymentLinkId || (result.paymentRequest && result.paymentRequest.razorpay && result.paymentRequest.razorpay.linkId), error: result.error || null, detail: result.detail || null })
  } catch (e) {
    console.error('[planRequests.renew] error', e)
    res.status(500).json({ error: 'Failed to create renewal payment' })
  }
})
const uploadMiddleware = upload.single('idDocument')

// Public: old submit endpoint is deprecated. Use /pay which creates invoice + payment link.
router.post('/', (req, res, next) => {
  uploadMiddleware(req, res, (err) => {
    if (err) console.error('[planRequests./] multer error:', err)
    next()
  })
}, async (req, res) => {
  return res.status(410).json({ error: 'Deprecated. Please use POST /api/plan-requests/pay to submit and pay for plans.' })
})

// Tenant-initiated upgrade endpoint: create invoice + payment link for upgrading tenant to a new plan
// Body: { tenantId, planId, period, requestedAmount }
router.post('/upgrade', protect, async (req, res) => {
  try {
    const { tenantId, planId, period, requestedAmount } = req.body || {}
    if (!tenantId || !planId) return res.status(400).json({ error: 'tenantId and planId required' })
    // Only allow tenant users for their own tenant, or director users
    if (req.userRole !== 'director' && String(req.tenantId) !== String(tenantId)) {
      return res.status(403).json({ error: 'Forbidden' })
    }

    const tenant = await Tenant.findById(tenantId)
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' })

    const plan = await Plan.findById(planId)
    if (!plan) return res.status(404).json({ error: 'Plan not found' })
    if (!plan.active) return res.status(400).json({ error: 'Plan not active' })

    // If plan is customized, require access code validation
    if (plan && plan.customized) {
      const providedCode = (req.body && (req.body.accessCode || req.body.code)) ? String(req.body.accessCode || req.body.code) : ''
      if (!providedCode) return res.status(400).json({ error: 'Access code required for customized plan' })
      if (!plan.accessCode || String(plan.accessCode).trim() !== String(providedCode).trim()) {
        return res.status(403).json({ error: 'Invalid access code' })
      }
    }

    // Basic eligibility check: ensure tenant current usage fits within new plan limits (best-effort)
    try {
      const usage = tenant.usage || { admins: 0, subAdmins: 0, doctors: 0, patients: 0 }
      const limits = plan.limits || {}
      if ((limits.admins || 0) > 0 && usage.admins > (limits.admins || 0)) {
        return res.status(400).json({ error: 'Upgrade not allowed: tenant has more admins than target plan permits' })
      }
      if ((limits.doctors || 0) > 0 && usage.doctors > (limits.doctors || 0)) {
        return res.status(400).json({ error: 'Upgrade not allowed: tenant has more doctors than target plan permits' })
      }
      // Enforce clinic-based upgrade rules: require at least one admin if the plan enables clinic features
      try {
        const isClinicPlan = (Array.isArray(plan.features) && plan.features.some(f => /clinic/i.test(String(f)))) ||
          (plan.roleFeatures && Array.isArray(plan.roleFeatures.admin) && plan.roleFeatures.admin.some(f => /clinic/i.test(String(f))))
        if (isClinicPlan && (usage.admins || 0) === 0) {
          return res.status(400).json({ error: 'Upgrade not allowed: clinic plans require at least one tenant admin to be present' })
        }
      } catch (e) { /* ignore */ }
    } catch (e) { /* ignore eligibility failures and allow admin/director to proceed */ }

    // Compute amount (in rupees) using helper
    let amount = paymentsService.computeAmountFromPlan(plan, period || 'monthly', requestedAmount || 0)
    if ((!amount || Number(amount) === 0) && Number(requestedAmount)) amount = Number(requestedAmount)
    if (!amount || Number(amount) === 0) return res.status(400).json({ error: 'Unable to compute amount for upgrade' })

    // Build invoice items: unitPrice expected in paise
    const itemAmount = Number(amount)
    const items = [{ description: `Plan upgrade: ${plan.name} (${period || 'monthly'})`, quantity: 1, unitPrice: itemAmount, gstRate: 0 }]

    // Determine billing contact: try tenant director user
    let billing = { period: period || 'monthly' }
    try {
      if (tenant && tenant.director) {
        const User = (await import('../models/User.js')).default
        const director = await User.findById(tenant.director).select('name email')
        if (director) billing.name = director.name || ''
        if (director && director.email) billing.email = director.email
      }
    } catch (e) { /* ignore */ }

    const createdBy = req.userId || null
    const createdByRole = req.userRole || 'public'

    // Use payments helper to create invoice + payment request + (attempt) razorpay link. Pass plan so invoice.plan is set and payments finalizer can set tenant.plan when paid.
    const result = await paymentsService.createInvoiceAndPaymentRequest({ patientName: billing.name || 'Customer', items, billing, plan: plan || null, createdBy, createdByRole, tenantId: tenant._id })
    return res.json({ ok: true, invoiceId: result.invoice?._id, paymentRequestId: result.paymentRequest?._id, paymentShortUrl: result.paymentShortUrl, paymentLinkId: result.paymentLinkId || (result.paymentRequest && result.paymentRequest.razorpay && result.paymentRequest.razorpay.linkId), error: result.error || null, detail: result.detail || null })
  } catch (e) {
    console.error('[planRequests.upgrade] error', e)
    res.status(500).json({ error: 'Failed to create upgrade payment' })
  }
})

// Public: submit and immediately create invoice + payment link (multipart/form-data)
router.post('/pay', (req, res, next) => {
  console.log('[planRequests./pay] starting file upload parsing...')
  uploadMiddleware(req, res, (err) => {
    if (err) {
      console.error('[planRequests./pay] multer upload error:', err)
      return res.status(500).json({ error: 'File upload failed', detail: err.message })
    }
    console.log('[planRequests./pay] upload parsing complete!')
    next()
  })
}, async (req, res) => {
  try {
    console.log('[planRequests./pay] executing core handler logic...');
    const body = req.body || {};
    console.log('[planRequests./pay] Received body keys:', Object.keys(body));
    const { planName, planId, customerName, customerEmail, customerPhone, customerCountryCode, address, description, company, period, agreed } = body;
    if (!planName || !customerName || !customerEmail) {
        console.error('[planRequests./pay] Missing required fields:', { planName: !!planName, customerName: !!customerName, customerEmail: !!customerEmail });
        return res.status(400).json({ error: 'Missing required fields (Plan Name, Name, and Email are required)' });
    }

    // Check if an admin already exists with this email
    const User = (await import('../models/User.js')).default;
    try {
        const existingAdmin = await User.findOne({ email: customerEmail, role: 'admin' });
        if (existingAdmin) {
            console.warn('[planRequests./pay] Admin email collision:', customerEmail);
            return res.status(409).json({ error: 'An admin account with this email already exists. Please login or use a different email.' });
        }
    } catch (dbErr) {
        console.error('[planRequests./pay] User existence check failed:', dbErr);
        // We might want to proceed or fail. Failing is safer to avoid duplicates if DB is flaky.
        return res.status(500).json({ error: 'Database verification failed', detail: dbErr.message });
    }

    const prObj = {
      planName,
      customerName,
      customerEmail,
      customerPhone,
      customerCountryCode,
      address,
      description,
      company,
      period: period || 'monthly',
      agreed: agreed === 'true' || agreed === true,
      status: 'new',
    }
    if (planId) prObj.planId = planId

    // Upload buffer to Cloudinary manually
    if (req.file) {
      try {
        const cldObj = await uploadToCloudinary(req.file.buffer, 'planRequests', 'raw')
        prObj.idDocument = { filename: req.file.originalname, originalname: req.file.originalname, path: cldObj.secure_url, mimetype: req.file.mimetype, size: req.file.size }
      } catch (e) {
        return res.status(500).json({ error: 'Cloudinary upload failed', detail: e.message })
      }
    }

    if (body.amount) {
      const num = Number(body.amount)
      if (!Number.isNaN(num)) prObj.requestedAmount = num
    }
    if (req.userId) prObj.createdBy = req.userId

    console.log('[pay debug] About to create PlanRequest', prObj);
    const createdPR = await PlanRequest.create(prObj)
    console.log('[pay debug] Created PlanRequest');

    // Try to find matching plan to compute amount
    let amountPaise = 0
    let plan = null
    // If planId provided, use it for exact lookup
    if (createdPR.planId) {
      plan = await Plan.findById(createdPR.planId)
    }
    if (!plan && createdPR.planName) {
      try {
        const allPlans = await Plan.find({})
        const wanted = (createdPR.planName || '').trim().toLowerCase()
        let fuzzy = allPlans.find(p => {
          if (!p || !p.name) return false
          const n = (p.name || '').trim().toLowerCase()
          return n === wanted || n.includes(wanted) || wanted.includes(n)
        })
        if (fuzzy) {
          plan = fuzzy
        }
      } catch (e) {
        console.warn('[planRequests.pay] fuzzy plan lookup failed', e)
      }
    }

    let amount = 0
    if (plan) {
      amount = paymentsService.computeAmountFromPlan(plan, createdPR.period || 'monthly', createdPR.requestedAmount || 0)
    } else if (createdPR.requestedAmount) {
      amount = Number(createdPR.requestedAmount) || 0
    }

    // Prefer frontend requestedAmount if provided (requestedAmount is in RUPEES)
    if (createdPR.requestedAmount && Number(createdPR.requestedAmount) > 0 && Number(createdPR.requestedAmount) !== Number(amount)) {
      amount = Number(createdPR.requestedAmount) || amount
    }

    // Convert to paise for the invoice
    amountPaise = Math.round(Number(amount) * 100)

    // Send received confirmation email in background
    try {
      const tpl = planRequestReceivedTemplate(prObj)
      setImmediate(() => {
        sendEmail(prObj.customerEmail, `${process.env.COMPANY_NAME || 'HMS'} — Request Received`, tpl.html, { attachments: tpl.attachments })
          .catch((e) => console.error('[planRequests.pay] failed to send receipt email', e))
      })
    } catch (e) {
      console.error('[planRequests.pay] failed to queue receipt email', e)
    }

    // Important: We no longer auto-approve here.
    // The PlanRequest is already created at the top of the try block.
    // We just return success after sending the email.
    
    console.log(`[planRequests] New request created for ${prObj.customerEmail} (Plan: ${prObj.planName}). Awaiting director vetting.`);

    res.status(201).json({ 
      success: true, 
      message: 'Plan request submitted successfully. Our team will review your application.',
      id: createdPR._id 
    })
  } catch (e) {
    console.error('[planRequests] public pay/submit error:', e);
    res.status(500).json({ 
      error: 'Submission failed', 
      detail: e.message,
      stack: process.env.NODE_ENV === 'development' ? e.stack : undefined
    });
  }
})

// Director-only: list requests
router.get('/', protect, requireRoles('director'), async (req, res) => {
  try {
    const list = await PlanRequest.find({}).sort({ createdAt: -1 })
    // compute an authoritative amount (in paise) for each request so director UI shows server-computed value
    const plans = await Plan.find({})
    const normalize = (s) => (String(s || '').trim().toLowerCase())
    const computeFor = (reqItem) => {
      try {
        const wanted = normalize(reqItem.planName)
        let plan = plans.find(p => normalize(p.name) === wanted)
        if (!plan) plan = plans.find(p => normalize(p.name).includes(wanted) || wanted.includes(normalize(p.name)))
        let amt = 0
        if (plan) {
          amt = paymentsService.computeAmountFromPlan(plan, reqItem.period || 'monthly', reqItem.requestedAmount || 0)
        } else if (reqItem && Number(reqItem.requestedAmount)) {
          amt = Number(reqItem.requestedAmount) || 0
        }
        return Number(amt) || 0
      } catch (e) { return 0 }
    }
    const enriched = list.map(r => ({ ...r, computedAmount: computeFor(r) }))
    res.json({ requests: enriched })
  } catch (e) {
    console.error('plan request list error', e)
    res.status(500).json({ error: 'Failed to load' })
  }
})

// Update status (director only)
// small helper to escape user-provided plan names for RegExp
function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')
}

router.put('/:id/status', protect, requireRoles('director'), async (req, res) => {
  try {
    const { id } = req.params
    const { status } = req.body
    if (!['new', 'processed', 'rejected'].includes(status)) return res.status(400).json({ error: 'Invalid status' })
    const existing = await PlanRequest.findById(id)
    if (!existing) return res.status(404).json({ error: 'Not found' })
    const pr = await PlanRequest.update(id, { status })
    console.log(`[planRequests] Status updated to ${status} for request ${id}`);

    // If processed, generate invoice and send approval email with payment CTA
    if (status === 'processed') {
      try {
        let plan = null
        if (pr.planName) {
          try {
            const allPlans = await Plan.find({})
            const wanted = (pr.planName || '').trim().toLowerCase()
            let fuzzy = allPlans.find(p => {
              if (!p || !p.name) return false
              const n = (p.name || '').trim().toLowerCase()
              return n === wanted || n.includes(wanted) || wanted.includes(n)
            })
            if (fuzzy) plan = fuzzy
          } catch (e) {
            console.warn('[planRequests] fuzzy plan lookup failed', e)
          }
        }

        let amount = 0
        if (plan) {
          amount = paymentsService.computeAmountFromPlan(plan, pr.period || 'monthly', pr.requestedAmount || 0)
        } else if (pr.requestedAmount) {
          amount = Number(pr.requestedAmount) || 0
        }

        // Correctly handle amount comparison and unit mismatch (paise vs rupees)
        if (pr.requestedAmount && Number(pr.requestedAmount) > 0) {
          const reqVal = Number(pr.requestedAmount)
          if (reqVal === amount * 100) {
            console.warn('[planRequests] unit mismatch detected: requested is 100x computed. Normalizing to computed.', { computed: amount, requested: reqVal })
            // Keep 'amount' as computed (rupees)
          } else if (reqVal !== amount) {
            console.warn('[planRequests] discrepancy preferring requestedAmount', { computed: amount, requested: reqVal })
            amount = reqVal
          }
        }

        console.log(`[planRequests] Creating invoice for ${pr.customerEmail} with amount ₹${amount}`);

        // Prepare billing data
        const billing = {
          name: pr.customerName,
          email: pr.customerEmail,
          company: pr.company,
          address: pr.address,
          phone: pr.customerPhone,
          countryCode: pr.customerCountryCode,
          period: pr.period || 'monthly'
        }

        // Use centralized payments service
        const result = await paymentsService.createInvoiceAndPaymentRequest({
          patientName: pr.customerName,
          items: [{ 
            description: `Plan subscription: ${pr.planName} (${pr.period || 'monthly'})`, 
            quantity: 1, 
            unitPrice: Number(amount), 
            gstRate: 0 
          }],
          billing,
          plan: plan || null,
          createdBy: req.userId,
          createdByRole: 'director',
          tenantId: pr.tenantId || null,
          planRequestId: String(pr._id)
        })

        if (!result.invoice) {
          throw new Error(result.error || 'Failed to create invoice via payments service')
        }

        const paymentShortUrl = result.paymentShortUrl
        const paymentLinkId = result.paymentLinkId
        const createdInvoiceId = result.invoice._id

        // Update the plan request with invoice and payment link info
        await PlanRequest.update(id, { 
          invoiceId: String(createdInvoiceId),
          paymentLinkId: paymentLinkId || null,
          paymentShortUrl: paymentShortUrl || null
        })

        console.log(`[planRequests] Invoice ${createdInvoiceId} created. ShortURL: ${paymentShortUrl}`);

        // Send approval email
        try {
          const tpl = planRequestApprovedTemplate(pr, result.invoice, paymentShortUrl)
          await sendEmail(pr.customerEmail, `${process.env.COMPANY_NAME || 'HMS'} — Request Approved`, tpl.html, { attachments: tpl.attachments })
          console.log(`[planRequests] Approval email sent to ${pr.customerEmail}`);
        } catch (emailErr) {
          console.error('[planRequests] Failed to send approval email', emailErr)
          // We don't throw here so the admin still gets the success response with the link
        }

        return res.json({ 
          ok: true,
          planRequest: pr, 
          responsePaymentShortUrl: paymentShortUrl, 
          invoiceId: createdInvoiceId,
          paymentRequestId: result.paymentRequest?._id
        })
      } catch (e) {
        console.error('[planRequests] Approval processing failed', e)
        return res.status(500).json({ error: 'Failed to process approval', detail: e.message })
      }
    } else if (status === 'rejected') {
      try {
        const tpl = planRequestRejectedTemplate(pr)
        await sendEmail(pr.customerEmail, `${process.env.COMPANY_NAME || 'HMS'} — Request Update`, tpl.html, { attachments: tpl.attachments })
        console.log(`[planRequests] Rejection email sent to ${pr.customerEmail}`);
      } catch (e) {
        console.error('[planRequests] Failed to send rejection email', e)
      }
    }
    // If not processed or if we didn't early-return above, return the updated planRequest
    res.json({ ok: true, planRequest: pr })
  } catch (e) {
    console.error('[planRequests] Update status error', e)
    res.status(500).json({ error: 'Failed to update' })
  }
})

// Delete plan request (director only)
router.delete('/:id', protect, requireRoles('director'), async (req, res) => {
  try {
    const { id } = req.params
    const pr = await PlanRequest.findById(id)
    if (!pr) return res.status(404).json({ error: 'Not found' })
    // We do not delete files from Cloudinary automatically to preserve history logs
    await PlanRequest.deleteOne({ _id: id })
    res.json({ ok: true })
  } catch (e) {
    console.error('plan request delete error', e)
    res.status(500).json({ error: 'Failed to delete' })
  }
})

export default router

// Dev-only: force-approve a plan request without auth for local testing
// Enable by setting environment variable ALLOW_DEV_APPROVE=true
router.post('/:id/dev-approve', async (req, res) => {
  try {
    if (!(process.env.ALLOW_DEV_APPROVE === 'true' || process.env.NODE_ENV === 'development')) {
      return res.status(403).json({ error: 'Dev approval disabled' })
    }
    const { id } = req.params
    const status = 'processed'
    
    console.log(`[planRequests][dev-approve] Attempting to update request ${id} to processed`)
    const pr = await PlanRequest.update(id, { status })
    if (!pr) {
      console.error(`[planRequests][dev-approve] Request ${id} not found`)
      return res.status(404).json({ error: 'Plan request not found' })
    }

    let plan = null
    if (pr.planName) {
      const allPlans = await Plan.find({})
      const wanted = (pr.planName || '').trim().toLowerCase()
      plan = allPlans.find(p => {
        if (!p || !p.name) return false
        const n = (p.name || '').trim().toLowerCase()
        return n === wanted || n.includes(wanted) || wanted.includes(n)
      })
    }

    let amount = 0
    if (plan) {
      amount = paymentsService.computeAmountFromPlan(plan, pr.period || 'monthly', pr.requestedAmount || 0)
    } else if (pr.requestedAmount) {
      amount = Number(pr.requestedAmount) || 0
    }

    console.log(`[planRequests][dev-approve] Creating invoice for ${pr.customerEmail} with amount ₹${amount}`)

    const billing = {
      name: pr.customerName,
      email: pr.customerEmail,
      company: pr.company,
      address: pr.address,
      phone: pr.customerPhone,
      countryCode: pr.customerCountryCode,
      period: pr.period || 'monthly'
    }

    const result = await paymentsService.createInvoiceAndPaymentRequest({
      patientName: pr.customerName,
      items: [{ 
        description: `Plan subscription: ${pr.planName} (${pr.period || 'monthly'})`, 
        quantity: 1, 
        unitPrice: Number(amount), 
        gstRate: 0 
      }],
      billing,
      plan: plan || null,
      createdBy: null,
      createdByRole: 'director',
      tenantId: pr.tenantId || null,
      planRequestId: String(pr._id)
    })

    if (!result.invoice) {
      throw new Error(result.error || 'Failed to create invoice')
    }

    // Send approval email
    try {
      const tpl = planRequestApprovedTemplate(pr, result.invoice, result.paymentShortUrl)
      await sendEmail(pr.customerEmail, `${process.env.COMPANY_NAME || 'HMS'} — Request Approved`, tpl.html, { attachments: tpl.attachments })
    } catch (e) { console.error('[dev-approve] sendEmail failed', e) }

    return res.json({ ok: true, planRequest: pr, invoiceId: result.invoice._id, paymentShortUrl: result.paymentShortUrl })
  } catch (e) {
    console.error('[dev-approve] error', e)
    return res.status(500).json({ error: 'Dev approve failed', detail: e.message })
  }
})
