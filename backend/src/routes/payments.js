import express from 'express'
import Razorpay from 'razorpay'
import crypto from 'crypto'
import PaymentRequest from '../models/PaymentRequest.js'
import Invoice from '../models/Invoice.js'
import Medicine from '../models/Medicine.js'
import User from '../models/User.js'
import Patient from '../models/Patient.js'
import { protect, admin } from '../utils/auth.js'
import { allowRolesWithSubadminFeature } from '../utils/permissions.js'
import PDFDocument from 'pdfkit'
import { sendEmail } from '../utils/notify.js'
import PlanReceipt from '../models/PlanReceipt.js'
import { provisionTenantForInvoice } from '../services/provisionTenant.js'
import path from 'path'
import fs from 'fs'
import { credentialsProvisionedTemplate } from '../utils/emailTemplates.js'
import { attemptOrQueueCredentialsEmail } from '../utils/emailJobs.js'
import { uploadToCloudinary } from '../config/cloudinary.js'
import tenantMiddleware from '../utils/tenant.js'
import { triggerBackgroundUpdate } from '../services/cacheService.js'
import { findInvoiceAcrossAllTenants, findPaymentRequestAcrossAllTenants, findPaymentRequestByLinkIdAcrossAllTenants } from '../utils/invoiceHelper.js'
import { generateAndUploadInvoicePdf } from '../utils/invoicePdfHelper.js'

const router = express.Router()

export const razorpayInstance = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_dummy',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'dummy_secret'
})
const RAZORPAY_KEY_ID_USED = process.env.RAZORPAY_KEY_ID || 'rzp_test_dummy'

export function getRazorpayInstance(tenant) {
  const key_id = tenant?.settings?.razorpayKeyId || process.env.RAZORPAY_KEY_ID || 'rzp_test_dummy'
  const key_secret = tenant?.settings?.razorpayKeySecret || process.env.RAZORPAY_KEY_SECRET || 'dummy_secret'
  if (!key_id) return null
  return new Razorpay({ key_id, key_secret })
}

// Helper to calculate totals
function calcTotals(items) {
  let subtotal = 0; let gstTotal = 0
  for (const item of items) {
    const unitPrice = Number(item.unitPrice) || 0
    const gstRate = Number(item.gstRate) || 0
    const line = unitPrice * (Number(item.quantity) || 0)
    const gst = line * (gstRate / 100)
    subtotal += line
    gstTotal += gst
  }
  return { subtotal, gstTotal, total: subtotal + gstTotal }
}

// Render an Invoice document into a PDF Buffer
async function renderInvoicePdfBuffer(inv) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 })
      const chunks = []
      doc.on('data', d => chunks.push(d))
      doc.on('end', () => resolve(Buffer.concat(chunks)))

      // All amounts in the system (Invoice/PaymentRequest) are now stored in RUPEES.
      // No scaling needed here.
      const scale = 1.0

      // Header
      doc.fontSize(18).text('Invoice', { align: 'center' })
      doc.moveDown(0.5)
      doc.fontSize(12).text(`Invoice Number: ${inv.invoiceNumber || inv._id}`)
      doc.text(`Date: ${new Date(inv.createdAt || Date.now()).toLocaleString()}`)
      doc.text(`Customer: ${inv.patientName || (inv.billing && inv.billing.name) || ''}`)
      if (inv.doctorName) doc.text(`Doctor: ${inv.doctorName}`)
      doc.moveDown()
      doc.fontSize(13).text('Items:')
      doc.moveDown(0.25)
      ;(inv.items || []).forEach(it => {
        const unitPrice = (Number(it.unitPrice) || 0) * scale
        const quantity = Number(it.quantity) || 0
        const gstRate = Number(it.gstRate) || 0
        const line = unitPrice * quantity
        const gst = line * (gstRate / 100)
        const name = it.medicine?.name || it.description || 'Item'
        doc.fontSize(11).text(`${name}  x${quantity} @ ${unitPrice.toFixed(2)}  GST ${gstRate}%  Line ${(line + gst).toFixed(2)}`)
      })
      doc.moveDown()
      const safeSubtotal = (Number.isFinite(inv.subtotal) ? inv.subtotal : 0) * scale
      const safeGstTotal = (Number.isFinite(inv.gstTotal) ? inv.gstTotal : 0) * scale
      const safeTotal = (Number.isFinite(inv.total) ? inv.total : (inv.subtotal + inv.gstTotal)) * scale

      doc.fontSize(12).text(`Subtotal: ${safeSubtotal.toFixed(2)}`)
      doc.text(`GST: ${safeGstTotal.toFixed(2)}`)
      doc.text(`Total: ${safeTotal.toFixed(2)}`)
      if (inv.status === 'paid' || inv.paid) {
        doc.moveDown()
        doc.fontSize(12).fillColor('green').text('Payment Received (PAID)', { align: 'right' })
        if (inv.payment) {
          doc.moveDown(0.5).fontSize(10).fillColor('black').text(`Provider: ${inv.payment.provider} | Txn: ${inv.payment.transactionId} | Date: ${new Date(inv.payment.paidAt).toLocaleString()}`, { align: 'right' })
        }
      }
      doc.end()
    } catch (e) {
      reject(e)
    }
  })
}

const processingLinks = new Set()

export async function createInvoiceFromPaymentRequest(pr, link, paymentInfo) {
  const customerEmail = (pr && pr.email) || (link && link.customer && link.customer.email) || (paymentInfo && paymentInfo.email) || undefined
  
  // Robust Unblocking helper
  const ensureUserUnblocked = async () => {
    try {
      let userToUnblock = null
      if (pr.invoice) userToUnblock = await User.findOne({ pendingInvoiceId: String(pr.invoice) })
      
      if (!userToUnblock && customerEmail) {
        const normalizeEmail = (v) => String(v || '').trim().toLowerCase()
        const email = normalizeEmail(customerEmail)
        if (email) {
          const [local, domain] = email.split('@')
          const variants = [email]
          if (domain === 'gmail.com' || domain === 'googlemail.com') {
            const lnp = local.split('+')[0], lnd = lnp.replace(/\./g, '')
            ;[`${lnp}@gmail.com`, `${lnd}@gmail.com`, `${lnp}@googlemail.com`, `${lnd}@googlemail.com`].forEach(x => { if (!variants.includes(x)) variants.push(x) })
          }
          const matchedUsers = await User.find({ email: { $in: variants } })
          for (const e of variants) {
            userToUnblock = matchedUsers.find(u => u.email === e)
            if (userToUnblock) break
          }
        }
      }
      
      if (userToUnblock && userToUnblock.pendingInvoiceId) {
        console.log('[payments] ensuring user is unblocked:', userToUnblock.email)
        await User.update(userToUnblock._id, { blocked: false, pendingInvoiceId: null })
      }
    } catch (e) {
      console.warn('[payments] ensureUserUnblocked failed:', e?.message || e)
    }
  }

  // Prevent double-processing
  if (pr.status === 'paid' && pr.invoice) {
    await ensureUserUnblocked()
    return pr.invoice
  }

  const lockKey = pr.razorpay?.linkId || pr._id?.toString() || link?.id
  if (lockKey) {
    if (processingLinks.has(lockKey)) {
      await ensureUserUnblocked()
      return pr.invoice
    }
    processingLinks.add(lockKey)
  }

  try {
    let inv = null
    if (pr.invoice) inv = await Invoice.forHospital(pr.tenantId).findById(pr.invoice)

    const customerEmail = (pr && pr.email) || (link && link.customer && link.customer.email) || (paymentInfo && paymentInfo.email) || undefined
    const customerName = pr && pr.patientName ? pr.patientName : (link && link.customer && link.customer.name) || ''
    const makePaymentObj = (pInfo) => {
      let rawAmtPaise = pInfo && pInfo.amount ? pInfo.amount : (link && link.amount ? link.amount : Number(pr.total || 0) * 100)
      return {
        provider: 'razorpay',
        transactionId: pInfo?.id || pInfo?.entity || link?.id || pInfo?.razorpay_payment_id,
        paidAt: pInfo && pInfo.created_at ? new Date(pInfo.created_at * 1000) : new Date(),
        amount: Number((rawAmtPaise / 100).toFixed(2)) // Convert back to RUPEES
      }
    }

    if (inv) {
      inv.paid = true
      inv.payment = paymentInfo ? makePaymentObj(paymentInfo) : makePaymentObj(link)
      // total comes from makePaymentObj above or existing inv.total
      inv.total = inv.payment.amount || inv.total
      if (pr.tenantId && !inv.tenantId) inv.tenantId = pr.tenantId

      if (!inv.patient) {
        let resolvedPatientId = pr.patient || null
        const emailToLookup = customerEmail || pr.email
        if (!resolvedPatientId && emailToLookup) {
          const PatientScoped = pr.tenantId ? Patient.forHospital(pr.tenantId) : Patient
          const patientDoc = await PatientScoped.findOne({ email: emailToLookup.toLowerCase() }).select('_id')
          if (patientDoc) resolvedPatientId = patientDoc._id
        }
        if (resolvedPatientId) inv.patient = resolvedPatientId
      }

      // Deduct stock if not already done
      if (!inv.stockDeducted && Array.isArray(inv.items)) {
        const stockPromises = inv.items.map(async (item) => {
          if (item.medicine) {
            const medId = (typeof item.medicine === 'object') ? (item.medicine._id || item.medicine.id) : item.medicine
            const med = await Medicine.forHospital(inv.tenantId || pr.tenantId).findById(medId)
            if (med) {
              const currentQty = Number(med.quantity) || 0
              const deductQty = Number(item.quantity) || 0
              await Medicine.forHospital(inv.tenantId || pr.tenantId).update(medId, { quantity: currentQty - deductQty })
            }
          }
        })
        await Promise.all(stockPromises)
        inv.stockDeducted = true
      }

      await inv.save()
    } else {
      let paidAmountPaise = (paymentInfo && paymentInfo.amount) ? paymentInfo.amount : (link && link.amount ? link.amount : Number(pr.total || 0) * 100)
      // Use tenant-scoped model so invoice lands in hospitals/{tenantId}/invoices
      // (same path that req.db(Invoice) reads from in GET /api/invoices)
      const InvoiceScoped = pr.tenantId ? Invoice.forHospital(pr.tenantId) : Invoice

      // Resolve patient ID
      let resolvedPatientId = pr.patient || null
      const emailToLookup = customerEmail || pr.email
      if (!resolvedPatientId && emailToLookup) {
        const PatientScoped = pr.tenantId ? Patient.forHospital(pr.tenantId) : Patient
        const patientDoc = await PatientScoped.findOne({ email: emailToLookup.toLowerCase() }).select('_id')
        if (patientDoc) resolvedPatientId = patientDoc._id
      }

      inv = InvoiceScoped._wrap({
        patientName: customerName || pr.patientName,
        patient: resolvedPatientId || undefined,
        items: pr.items,
        subtotal: pr.subtotal,
        gstTotal: pr.gstTotal,
        total: Number((paidAmountPaise / 100).toFixed(2)), // Convert back to RUPEES
        createdBy: pr.createdBy,
        createdByRole: pr.createdByRole,
        doctor: pr.doctor?.id,
        doctorName: pr.doctor?.name,
        plan: pr.plan || null,
        billing: { email: customerEmail || '', name: customerName || '' }
      })
      if (pr.tenantId) inv.tenantId = pr.tenantId
      inv.paid = true
      inv.payment = paymentInfo ? makePaymentObj(paymentInfo) : makePaymentObj(link)

      // Deduct stock
      if (Array.isArray(inv.items)) {
        const stockPromises = inv.items.map(async (item) => {
          if (item.medicine) {
            const medId = (typeof item.medicine === 'object') ? (item.medicine._id || item.medicine.id) : item.medicine
            const med = await Medicine.forHospital(inv.tenantId || pr.tenantId).findById(medId)
            if (med) {
              const currentQty = Number(med.quantity) || 0
              const deductQty = Number(item.quantity) || 0
              await Medicine.forHospital(inv.tenantId || pr.tenantId).update(medId, { quantity: currentQty - deductQty })
            }
          }
        })
        await Promise.all(stockPromises)
        inv.stockDeducted = true
      }

      await inv.save()
    }

    // Process logic for plan receipts & provisioning
    if (inv.plan || pr.plan) {
      try {
        const pdfBuffer2 = await renderInvoicePdfBuffer(inv)
        console.log('[payments] uploading plan receipt PDF to Cloudinary')
        const result = await uploadToCloudinary(pdfBuffer2, 'plan-receipts', 'auto')
        const pdfUrl = result.secure_url

        await PlanReceipt.create({
          invoice: inv._id,
          invoiceNumber: inv.invoiceNumber,
          plan: inv.plan || null,
          billing: inv.billing || {},
          total: inv.total,
          paidAt: inv.payment?.paidAt || new Date(),
          pdfUrl,
          pdfPath: pdfUrl, // backward compat
          tenantId: inv.tenantId || pr.tenantId || null
        })

        // Update tenant subscription
        const Tenant = (await import('../models/Tenant.js')).default
        const tenantId = inv.tenant || inv.tenantId || pr.tenantId || null
        if (tenantId) {
          const tenant = await Tenant.findById(tenantId)
          if (tenant) {
            const now = new Date()
            const period = (inv.billing && inv.billing.period) ? String(inv.billing.period).toLowerCase() : (pr.period ? String(pr.period).toLowerCase() : 'monthly')
            const addMonths = (date, months) => { const d = new Date(date); d.setMonth(d.getMonth() + months); return d }
            let newEnd = null
            if (period === '3months') newEnd = addMonths(tenant.subscriptionEnd && new Date(tenant.subscriptionEnd) > now ? tenant.subscriptionEnd : now, 3)
            else if (period === 'yearly' || period === 'year') newEnd = addMonths(tenant.subscriptionEnd && new Date(tenant.subscriptionEnd) > now ? tenant.subscriptionEnd : now, 12)
            else if (period === '5years') newEnd = addMonths(tenant.subscriptionEnd && new Date(tenant.subscriptionEnd) > now ? tenant.subscriptionEnd : now, 60)
            else newEnd = addMonths(tenant.subscriptionEnd && new Date(tenant.subscriptionEnd) > now ? tenant.subscriptionEnd : now, 1)

            tenant.subscriptionStart = tenant.subscriptionStart || now
            tenant.subscriptionEnd = newEnd
            if (inv.plan) tenant.plan = inv.plan
            await tenant.save()
          }
        }

        // Send Receipt Email to the customer who paid
        const receiptRecipient = inv.billing?.email || pr.email
        if (receiptRecipient) {
          try {
            const { invoicePaidTemplate } = await import('../utils/emailTemplates.js')
            const tplReceipt = invoicePaidTemplate(inv)
            await sendEmail(receiptRecipient, `${process.env.COMPANY_NAME || 'HMS'} — Payment Receipt`, tplReceipt.html, { attachments: tplReceipt.attachments })
          } catch (emailErr) {
            console.error('[payments] failed to send receipt email', emailErr)
          }
        }

        // Provisioning
        if (inv.billing?.email) {
          const { tenant: provisionedTenant, user, presetPassword } = await provisionTenantForInvoice(inv)
          if (provisionedTenant && user) {
            inv.tenant = provisionedTenant._id
            
            // Use the centralized job helper for reliable delivery (immediate attempt + queue on fail)
            console.log('[payments] attempting/queuing credentials email for:', user.email)
            await attemptOrQueueCredentialsEmail({ 
              invoice: inv, 
              user, 
              tenant: provisionedTenant, 
              presetPassword, 
              reason: 'razorpay-payment' 
            })
            
            // Reload invoice as job helper might have modified it (credentialsDelivery state)
            await inv.save() 
          }
        }
      } catch (e) { console.error('[payments] plan receipt/provisioning error', e) }
    }

    pr.invoice = pr.invoice || inv._id
    pr.status = 'paid'
    await pr.save()

    // Update PlanRequest status if linked
    if (pr.planRequestId) {
        try {
            const PlanRequest = (await import('../models/PlanRequest.js')).default
            await PlanRequest.update(pr.planRequestId, { status: 'paid' })
            console.log('[payments] updated PlanRequest status to paid:', pr.planRequestId)
        } catch (e) {
            console.error('[payments] failed to update PlanRequest status:', e)
        }
    }

    // Update prescription status if present
    if (pr.prescriptionId) {
        try {
            const Prescription = (await import('../models/Prescription.js')).default
            await Prescription.forHospital(pr.tenantId).update(pr.prescriptionId, { pharmacyStatus: 'paid' })
            console.log('[payments] updated prescription status to paid:', pr.prescriptionId)
        } catch (e) {
            console.error('[payments] failed to update prescription status:', e)
        }
    }

    await ensureUserUnblocked()

    triggerBackgroundUpdate(pr.tenantId || inv.tenantId)

    // Trigger PDF generation and upload to Firebase Storage in the background
    generateAndUploadInvoicePdf(inv._id.toString(), pr.tenantId || inv.tenantId).catch(() => null)

    return inv._id
  } finally {
    if (lockKey) setTimeout(() => processingLinks.delete(lockKey), 15000)
  }
}

// Routes
router.post('/razorpay/create-link', protect, async (req, res) => {
  try {
    const { patientName, items, email, phone, doctorId, doctorName, prescriptionId, patientId } = req.body || {}
    if (!patientName || !Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'Invalid payload' })

    // Look up patient ID by email or use provided patientId
    let resolvedPatientId = patientId || null
    if (!resolvedPatientId && email) {
      const PatientModel = req.tenantId ? Patient.forHospital(req.tenantId) : Patient
      const patientDoc = await PatientModel.findOne({ email: email.toLowerCase() }).select('_id')
      if (patientDoc) resolvedPatientId = patientDoc._id
    }

    const totals = calcTotals(items)
    const pr = req.db(PaymentRequest)._wrap({ 
      patientName, 
      patient: resolvedPatientId || undefined,
      items: items.map(it => ({ ...it, unitPrice: Number(it.unitPrice) })), // Store in RUPEES
      subtotal: totals.subtotal, 
      gstTotal: totals.gstTotal, 
      total: totals.total, 
      createdBy: req.userId, 
      createdByRole: req.userRole, 
      email, 
      phone, 
      doctor: { id: doctorId || undefined, name: doctorName || undefined },
      prescriptionId: prescriptionId || undefined
    })
    if (req.tenantId) pr.tenantId = req.tenantId
    await pr.save()

    let cleanPhone = undefined
    if (pr.phone) {
      const formatted = String(pr.phone).trim().replace(/[^\d+]/g, '')
      if (/^\+?\d{10,14}$/.test(formatted)) {
        cleanPhone = formatted
      }
    }

    const options = {
      amount: Math.round(Number(pr.total) * 100), // Convert to PAISE for Razorpay
      currency: 'INR',
      description: `Invoice for ${pr.patientName}`,
      reference_id: String(pr._id),
      customer: {
        name: pr.patientName,
        ...(cleanPhone ? { contact: cleanPhone } : {}),
        ...(pr.email ? { email: pr.email } : (!cleanPhone ? { email: 'patient@hms.com' } : {}))
      },
      callback_url: (process.env.FRONTEND_URL || 'http://localhost:5174').replace(/\/$/, '') + '/?payment_redirect=true',
      callback_method: 'get'
    }
    let link
    let isMock = false
    try {
      link = await razorpayInstance.paymentLink.create(options)
    } catch (razorpayErr) {
      console.warn('[payments/create-link] Razorpay link creation failed, falling back to mock link:', razorpayErr.message)
      isMock = true
    }

    if (isMock || !link) {
      const mockLinkId = 'mock_' + pr._id
      pr.razorpay = { 
        linkId: mockLinkId, 
        shortUrl: `/api/payments/razorpay/mock-checkout/${mockLinkId}`, 
        status: 'issued' 
      }
      await pr.save()
      res.json({ ok: true, shortUrl: `/api/payments/razorpay/mock-checkout/${mockLinkId}`, paymentRequestId: pr._id })
    } else {
      pr.razorpay = { linkId: link.id, shortUrl: link.short_url, status: link.status }
      await pr.save()
      res.json({ ok: true, shortUrl: link.short_url, paymentRequestId: pr._id })
    }
  } catch (e) {
    console.error('[payments/create-link] error:', e)
    res.status(500).json({ error: e.message })
  }
})


// Create a payment request/link for an existing invoice (public endpoint)
router.post('/razorpay/create-link-from-invoice/:invoiceId', async (req, res) => {
  try {
    const { invoiceId } = req.params
    // 1. Resolve invoice and its tenantId across all tenants
    const resolved = await findInvoiceAcrossAllTenants(invoiceId)
    if (!resolved) return res.status(404).json({ error: 'Invoice not found' })

    const tenantId = resolved.tenantId
    const Tenant = (await import('../models/Tenant.js')).default
    const tenant = tenantId ? await Tenant.findById(tenantId) : null

    // 2. Fetch invoice with patient user populated
    const Invoice = (await import('../models/Invoice.js')).default
    const scopedInvoiceModel = tenantId ? Invoice.forHospital(tenantId) : Invoice
    const invoice = await scopedInvoiceModel.findById(invoiceId).populate('patientUser')
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' })

    // Total is in Rupees; convert to Paise for Razorpay
    const amountPaise = Math.round(invoice.total * 100)

    let cleanPhone = undefined
    const phone = invoice.patientUser?.phone
    if (phone) {
      const formatted = String(phone).trim().replace(/[^\d+]/g, '')
      if (/^\+?\d{10,14}$/.test(formatted)) {
        cleanPhone = formatted
      }
    }

    const options = {
      amount: amountPaise,
      currency: 'INR',
      accept_partial: false,
      description: `Payment for Invoice #${invoice.invoiceNumber || invoice._id}`,
      customer: {
        name: invoice.patientName || invoice.patientUser?.name || 'Patient',
        ...(invoice.patientUser?.email ? { email: invoice.patientUser.email } : (!cleanPhone ? { email: 'patient@hms.com' } : {})),
        ...(cleanPhone ? { contact: cleanPhone } : {})
      },
      notify: { sms: true, email: true },
      reminder_enable: true,
      notes: { invoiceId: String(invoice._id), tenantId: tenantId ? String(tenantId) : '' },
      callback_url: tenant 
        ? `${process.env.FRONTEND_URL}/portal/${tenant.slug}/invoice/${invoice._id}` 
        : `${process.env.FRONTEND_URL}/invoice/${invoice._id}`,
      callback_method: 'get'
    }

    const instance = await getRazorpayInstance(tenant)
    let link
    let isMock = false
    
    if (instance) {
      try {
        link = await instance.paymentLink.create(options)
      } catch (err) {
        console.warn('[create-link-from-invoice] Razorpay link creation failed, falling back to mock link:', err.message)
        isMock = true
      }
    } else {
      isMock = true
    }

    if (isMock || !link) {
      const mockLinkId = 'mock_' + invoice._id
      res.json({
        success: true,
        shortUrl: `/api/payments/razorpay/mock-checkout/${mockLinkId}`,
        linkId: mockLinkId,
        paymentRequestId: mockLinkId,
        keyId: 'rzp_test_dummy'
      })
    } else {
      res.json({
        success: true,
        shortUrl: link.short_url,
        linkId: link.id,
        paymentRequestId: link.id,
        keyId: (tenant?.settings?.razorpayKeyId || process.env.RAZORPAY_KEY_ID)
      })
    }
  } catch (e) {
    console.error('[create-link-from-invoice] error:', e)
    res.status(500).json({ error: e.message || 'Payment link creation failed' })
  }
})

router.post('/razorpay/create-order', protect, tenantMiddleware, async (req, res) => {
  try {
    const { paymentRequestId } = req.body
    if (!paymentRequestId) return res.status(400).json({ error: 'paymentRequestId required' })
    const pr = await req.db(PaymentRequest).findById(paymentRequestId)
    if (!pr) return res.status(404).json({ error: 'PaymentRequest not found' })

    const options = {
      amount: Math.round(Number(pr.total) * 100), // Convert to PAISE for Razorpay
      currency: 'INR',
      receipt: String(pr._id)
    }
    const order = await razorpayInstance.orders.create(options)
    res.json({ ok: true, order, keyId: RAZORPAY_KEY_ID_USED })
  } catch (e) { 
    console.error('[payments/create-order] error:', e)
    res.status(500).json({ error: e.message }) 
  }
})

router.post('/razorpay/verify-payment', protect, async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body
    const secret = process.env.RAZORPAY_KEY_SECRET
    
    const body = razorpay_order_id + '|' + razorpay_payment_id
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(body.toString())
      .digest('hex')

    if (expectedSignature === razorpay_signature) {
      const order = await razorpayInstance.orders.fetch(razorpay_order_id)
      const prId = order.receipt
      const resolvedPr = await findPaymentRequestAcrossAllTenants(prId)
      if (!resolvedPr) return res.status(404).json({ error: 'PaymentRequest not found' })
      const PaymentRequestScoped = resolvedPr.tenantId ? PaymentRequest.forHospital(resolvedPr.tenantId) : PaymentRequest
      const pr = PaymentRequestScoped._wrap({ _id: prId, id: prId, ...resolvedPr.data })
      
      const invoiceId = await createInvoiceFromPaymentRequest(pr, null, { 
        id: razorpay_payment_id, 
        amount: order.amount,
        razorpay_payment_id // for compatibility with makePaymentObj helper
      })
      res.json({ success: true, invoiceId })
    } else {
      res.status(400).json({ success: false, message: 'Invalid signature' })
    }
  } catch (e) { 
    console.error('[payments/verify-payment] error:', e)
    res.status(500).json({ error: e.message }) 
  }
})

const handleCheckPaymentLink = async (req, res) => {
  try {
    const linkId = req.params.linkId
    if (String(linkId).startsWith('mock_')) {
      const id = String(linkId).replace('mock_', '')
      
      // Check if it's a PaymentRequest
      const resolvedPr = await findPaymentRequestAcrossAllTenants(id)
      if (resolvedPr) {
        const PaymentRequestScoped = resolvedPr.tenantId ? PaymentRequest.forHospital(resolvedPr.tenantId) : PaymentRequest
        const pr = PaymentRequestScoped._wrap({ _id: id, id, ...resolvedPr.data })
        const paid = pr.razorpay?.status === 'paid'
        if (paid) {
          const invoiceId = await createInvoiceFromPaymentRequest(pr, null, {
            id: 'pay_mock_' + pr._id,
            amount: Math.round(Number(pr.total) * 100),
            razorpay_payment_id: 'pay_mock_' + pr._id
          })
          return res.json({ ok: true, paid: true, invoiceId })
        }
        return res.json({ ok: true, status: pr.razorpay?.status || 'issued', paid })
      }

      // Check if it's an Invoice
      const resolvedInv = await findInvoiceAcrossAllTenants(id)
      if (resolvedInv) {
        const InvoiceScoped = resolvedInv.tenantId ? Invoice.forHospital(resolvedInv.tenantId) : Invoice
        const inv = InvoiceScoped._wrap({ _id: id, id, ...resolvedInv.data })
        const paid = inv.paid || inv.status === 'paid'
        return res.json({ ok: true, status: paid ? 'paid' : 'issued', paid, invoiceId: inv._id })
      }

      return res.status(404).json({ error: 'Mock reference not found' })
    }

    const link = await razorpayInstance.paymentLink.fetch(linkId)
    const paid = link.status === 'paid'
    if (paid) {
      const resolvedPr = await findPaymentRequestByLinkIdAcrossAllTenants(linkId)
      if (resolvedPr) {
        const PaymentRequestScoped = resolvedPr.tenantId ? PaymentRequest.forHospital(resolvedPr.tenantId) : PaymentRequest
        const pr = PaymentRequestScoped._wrap({ _id: resolvedPr.docRef.id, id: resolvedPr.docRef.id, ...resolvedPr.data })
        const paymentInfo = link.payments?.[0]
        const invoiceId = await createInvoiceFromPaymentRequest(pr, link, paymentInfo)
        return res.json({ ok: true, paid: true, invoiceId })
      }
    }
    res.json({ ok: true, status: link.status, paid })
  } catch (e) { res.status(500).json({ error: e.message }) }
}

router.get('/razorpay/check-public/:linkId', handleCheckPaymentLink)
router.get('/razorpay/check/:linkId', handleCheckPaymentLink)

router.get('/razorpay/mock-checkout/:linkId', async (req, res) => {
  try {
    const linkId = req.params.linkId
    if (!String(linkId).startsWith('mock_')) {
      return res.status(400).send('Invalid mock link ID')
    }
    const id = String(linkId).replace('mock_', '')
    
    let doc = null
    let type = 'Payment Request'
    const resolvedPr = await findPaymentRequestAcrossAllTenants(id)
    if (resolvedPr) {
      const PaymentRequestScoped = resolvedPr.tenantId ? PaymentRequest.forHospital(resolvedPr.tenantId) : PaymentRequest
      doc = PaymentRequestScoped._wrap({ _id: id, id, ...resolvedPr.data })
    } else {
      const resolvedInv = await findInvoiceAcrossAllTenants(id)
      if (resolvedInv) {
        const InvoiceScoped = resolvedInv.tenantId ? Invoice.forHospital(resolvedInv.tenantId) : Invoice
        doc = InvoiceScoped._wrap({ _id: id, id, ...resolvedInv.data })
        type = 'Invoice'
      }
    }
    
    if (!doc) {
      return res.status(404).send('Payment details not found')
    }

    const patientName = doc.patientName || 'Patient'
    const total = doc.total || 0
    const items = doc.items || []

    const itemsHtml = items.map(item => `
      <div class="flex justify-between border-b border-slate-100 py-2 text-slate-600">
        <div>
          <span class="font-medium">${item.description || 'Medical Item'}</span>
          <span class="text-xs text-slate-400">x${item.quantity || 1}</span>
        </div>
        <span class="font-semibold text-slate-800">₹${Number(item.unitPrice || 0).toFixed(2)}</span>
      </div>
    `).join('')

    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>PharmaPlus HMS - Simulated Checkout</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet">
        <style>
          body { font-family: 'Outfit', sans-serif; }
        </style>
      </head>
      <body class="bg-gradient-to-tr from-slate-900 via-indigo-950 to-slate-900 min-h-screen flex items-center justify-center p-4">
        <div class="bg-white/80 backdrop-blur-xl rounded-2xl shadow-2xl max-w-md w-full p-8 border border-white/20">
          <div class="flex flex-col items-center mb-6">
            <div class="bg-indigo-600 text-white p-3 rounded-full mb-3 shadow-lg shadow-indigo-500/30">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <h1 class="text-2xl font-bold text-slate-900">PharmaPlus Checkout</h1>
            <span class="text-xs font-semibold bg-indigo-100 text-indigo-800 px-2.5 py-0.5 rounded-full mt-2 uppercase tracking-wide">Simulator</span>
          </div>

          <div class="bg-slate-50 rounded-xl p-4 mb-6">
            <div class="text-xs text-slate-400 uppercase font-semibold tracking-wider mb-2">Transaction Details</div>
            <div class="flex justify-between mb-1">
              <span class="text-slate-500 text-sm">Patient Name</span>
              <span class="text-slate-800 font-semibold text-sm">${patientName}</span>
            </div>
            <div class="flex justify-between mb-3">
              <span class="text-slate-500 text-sm">Type</span>
              <span class="text-slate-800 font-semibold text-sm">${type}</span>
            </div>
            <div class="border-t border-slate-200 pt-3">
              <div class="text-xs text-slate-400 uppercase font-semibold tracking-wider mb-2">Items</div>
              <div class="max-h-40 overflow-y-auto pr-1">
                ${itemsHtml}
              </div>
            </div>
            <div class="border-t border-slate-200 pt-3 mt-3 flex justify-between items-center">
              <span class="text-slate-800 font-bold">Total Amount</span>
              <span class="text-2xl font-black text-indigo-600">₹${Number(total).toFixed(2)}</span>
            </div>
          </div>

          <div class="space-y-3">
            <button id="pay-btn" class="w-full bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-bold py-3.5 px-4 rounded-xl shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 transition duration-300">
              Confirm Simulated Payment
            </button>
            <button id="cancel-btn" class="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium py-3 px-4 rounded-xl transition duration-200">
              Cancel & Fail Payment
            </button>
          </div>

          <div class="mt-6 text-center text-xs text-slate-400">
            This is a secure billing simulator. Real money will not be charged.
          </div>
        </div>

        <script>
          document.getElementById('pay-btn').addEventListener('click', async () => {
            const btn = document.getElementById('pay-btn');
            btn.disabled = true;
            btn.innerHTML = 'Processing...';
            try {
              const res = await fetch('/api/payments/razorpay/mock-checkout/${linkId}/pay', { method: 'POST' });
              if (res.ok) {
                btn.innerHTML = 'Success! Closing...';
                btn.classList.remove('from-indigo-600', 'to-indigo-700');
                btn.classList.add('bg-emerald-600');
                setTimeout(() => window.close(), 1500);
              } else {
                alert('Payment failed');
                btn.disabled = false;
                btn.innerHTML = 'Confirm Simulated Payment';
              }
            } catch (e) {
              alert('Error connecting to simulator');
              btn.disabled = false;
              btn.innerHTML = 'Confirm Simulated Payment';
            }
          });

          document.getElementById('cancel-btn').addEventListener('click', () => {
            window.close();
          });
        </script>
      </body>
      </html>
    `
    res.send(html)
  } catch (e) {
    res.status(500).send('Error loading simulator')
  }
})

router.post('/razorpay/mock-checkout/:linkId/pay', async (req, res) => {
  try {
    const linkId = req.params.linkId
    if (!String(linkId).startsWith('mock_')) {
      return res.status(400).json({ error: 'Invalid mock link ID' })
    }
    const id = String(linkId).replace('mock_', '')
    
    // Check if it's a PaymentRequest
    const resolvedPr = await findPaymentRequestAcrossAllTenants(id)
    if (resolvedPr) {
      const PaymentRequestScoped = resolvedPr.tenantId ? PaymentRequest.forHospital(resolvedPr.tenantId) : PaymentRequest
      const pr = PaymentRequestScoped._wrap({ _id: id, id, ...resolvedPr.data })
      pr.razorpay = pr.razorpay || {}
      pr.razorpay.status = 'paid'
      await pr.save()
      return res.json({ ok: true, message: 'Simulated payment successful' })
    }

    // Check if it's an Invoice
    const resolvedInv = await findInvoiceAcrossAllTenants(id)
    if (resolvedInv) {
      const InvoiceScoped = resolvedInv.tenantId ? Invoice.forHospital(resolvedInv.tenantId) : Invoice
      const inv = InvoiceScoped._wrap({ _id: id, id, ...resolvedInv.data })
      inv.paid = true
      inv.status = 'paid'
      inv.paidAt = new Date()
      inv.paymentMethod = 'mock'
      inv.payment = {
        id: 'pay_mock_' + inv._id,
        amount: Math.round(Number(inv.total) * 100),
        razorpay_payment_id: 'pay_mock_' + inv._id,
        method: 'mock',
        status: 'captured'
      }
      await inv.save()
      return res.json({ ok: true, message: 'Simulated invoice payment successful' })
    }

    res.status(404).json({ error: 'Document not found' })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.post('/razorpay/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET
    const sig = req.headers['x-razorpay-signature']
    if (secret && sig) {
      const expected = crypto.createHmac('sha256', secret).update(req.body.toString()).digest('hex')
      if (sig !== expected) return res.status(400).send('Invalid signature')
    }
    const payload = JSON.parse(req.body.toString())
    if (payload.event === 'payment_link.paid') {
      const entity = payload.payload.payment_link.entity
      const resolvedPr = await findPaymentRequestByLinkIdAcrossAllTenants(entity.id)
      if (resolvedPr) {
        const PaymentRequestScoped = resolvedPr.tenantId ? PaymentRequest.forHospital(resolvedPr.tenantId) : PaymentRequest
        const pr = PaymentRequestScoped._wrap({ _id: resolvedPr.docRef.id, id: resolvedPr.docRef.id, ...resolvedPr.data })
        await createInvoiceFromPaymentRequest(pr, entity, entity.payments?.[0])
      }
    }
    res.json({ ok: true })
  } catch (e) { res.status(500).send('Error') }
})

export default router
