import express from 'express'
import Invoice from '../models/Invoice.js'
import Medicine from '../models/Medicine.js'
import User from '../models/User.js'
import Patient from '../models/Patient.js'
import PaymentRequest from '../models/PaymentRequest.js'
import { sendEmail } from '../utils/notify.js'
import { invoicePaidTemplate, credentialsProvisionedTemplate } from '../utils/emailTemplates.js'
import { provisionTenantForInvoice } from '../services/provisionTenant.js'
import { protect, patient as patientRole, admin } from '../utils/auth.js'
import { allowRolesWithSubadminFeature } from '../utils/permissions.js'
import PDFDocument from 'pdfkit'
import fs from 'fs'
import path from 'path'
import PlanReceipt from '../models/PlanReceipt.js'
import { uploadToCloudinary } from '../config/cloudinary.js'
import { triggerBackgroundUpdate } from '../services/cacheService.js'
import { addPdfJob } from '../queues/pdfQueue.js'
import { generateAndUploadInvoicePdf } from '../utils/invoicePdfHelper.js'
import jwt from 'jsonwebtoken'
import { findInvoiceAcrossAllTenants } from '../utils/invoiceHelper.js'
import FirestoreModel from '../models/firestore/FirestoreModel.js'

const router = express.Router()

// Authenticated patient: list only their invoices (by name fallback)
router.get('/my', protect, patientRole, async (req, res) => {
  const user = await User.findById(req.userId).select('name email')
  if (!user) return res.status(404).json({ error: 'User not found' })

  // Try to resolve a Patient document by email (if exists) so invoices attached to patient id are included
  let patientDoc = null
  try {
    if (user.email) patientDoc = await req.db(Patient).findOne({ email: user.email }).select('_id')
  } catch (e) { /* ignore */ }

  const limit = Number(req.query.limit) || 100
  const page = Number(req.query.page) || 1
  const skip = (page - 1) * limit

  let query1 = []
  if (patientDoc && patientDoc._id) {
    query1 = await req.db(Invoice).find({ patient: patientDoc._id }).populate('items.medicine')
  }

  let query2 = []
  if (user.name) {
    query2 = await req.db(Invoice).find({ patientName: user.name }).populate('items.medicine')
  }

  const mergedMap = new Map()
  query1.forEach(inv => mergedMap.set(String(inv._id || inv.id), inv))
  query2.forEach(inv => mergedMap.set(String(inv._id || inv.id), inv))
  let data = Array.from(mergedMap.values())

  data = data.filter(inv => inv.hiddenByPatient !== true)

  data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

  if (req.query.limit !== 'all') {
    data = data.slice(skip, skip + limit)
  }

  res.json(data)
})

// Patient hide (delete) their invoice from their view
router.patch('/:id/hide', protect, patientRole, async (req, res) => {
  try {
    const inv = await req.db(Invoice).findById(req.params.id)
    if (!inv) return res.status(404).json({ error: 'Invoice not found' })
    const user = await User.findById(req.userId).select('name')
    if (!user) return res.status(404).json({ error: 'User not found' })
    if (inv.patientName !== user.name) return res.status(403).json({ error: 'Forbidden' })
    inv.hiddenByPatient = true
    await inv.save()
    res.json({ ok: true })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Server error' })
  }
})

// Patient creates an invoice for selected medicines
router.post('/my', protect, patientRole, async (req, res) => {
  const user = await User.findById(req.userId).select('name email')
  if (!user) return res.status(404).json({ error: 'User not found' })
  const { items } = req.body // expecting [{ medicine, quantity }]
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'No items provided' })
  }
  try {
    const normalized = []
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const medicineDocs = await Promise.all(items.map(raw => 
      req.db(Medicine).findById(raw.medicine).select('name quantity sellingPrice gstRate expiryDate')
    ))
    for (let idx = 0; idx < items.length; idx++) {
      const raw = items[idx]
      const med = medicineDocs[idx]
      if (!med) return res.status(400).json({ error: 'Medicine not found' })
      if (med.expiryDate && med.expiryDate < today) {
        return res.status(400).json({ error: `Medicine "${med.name}" is expired` })
      }
      const qty = Number(raw.quantity)
      if (!qty || qty <= 0) return res.status(400).json({ error: 'Invalid quantity' })
      if ((med.quantity || 0) < qty) return res.status(400).json({ error: `Insufficient stock for "${med.name}"` })
      normalized.push({ medicine: med._id, quantity: qty, unitPrice: med.sellingPrice, gstRate: med.gstRate })
    }

    let resolvedPatientId = null
    if (user.email) {
      const patientDoc = await req.db(Patient).findOne({ email: user.email.toLowerCase() }).select('_id')
      if (patientDoc) resolvedPatientId = patientDoc._id
    }

    let subtotal = 0; let gstTotal = 0
    for (const it of normalized) {
      const line = it.unitPrice * it.quantity
      const gst = line * (it.gstRate / 100)
      subtotal += line
      gstTotal += gst
    }
    const total = subtotal + gstTotal
    const inv = req.db(Invoice)._wrap({
      patientName: user.name,
      patient: resolvedPatientId || undefined,
      items: normalized,
      subtotal,
      gstTotal,
      total,
      createdBy: req.userId,
      createdByRole: 'patient'
    })
    if (req.tenantId) inv.tenantId = req.tenantId
    await inv.save()

    // Trigger PDF generation in background
    generateAndUploadInvoicePdf(inv._id.toString(), req.tenantId).catch(() => null)

    const populated = await inv.populate('items.medicine')
    triggerBackgroundUpdate(req.tenantId)
    res.status(201).json(populated)
  } catch (e) {
    return res.status(500).json({ error: 'Invoice creation failed' })
  }
})

// Admin: list all invoices (admin/director or permitted subadmin)
router.get('/', protect, allowRolesWithSubadminFeature(['admin', 'director', 'subadmin'], 'manage_invoices'), async (req, res, next) => {
  try {
    const limit = Number(req.query.limit) || 100
    const page = Number(req.query.page) || 1
    const skip = (page - 1) * limit

    if (req.userRole === 'director') {
      const { db } = await import('../config/firebase.js')
      const snapshot = await db.collectionGroup('invoices').get()
      let data = snapshot.docs.map(doc => {
        const rawData = doc.data()
        for (const k in rawData) {
          if (rawData[k] && typeof rawData[k].toDate === 'function') rawData[k] = rawData[k].toDate()
        }
        const pathSegments = doc.ref.path.split('/')
        const tId = pathSegments[1]
        return { _id: doc.id, id: doc.id, tenantId: tId, ...rawData }
      })

      // Sort by createdAt desc in-memory
      data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

      if (req.query.limit !== 'all') {
        data = data.slice(skip, skip + limit)
      }

      // Populate each item manually with appropriate tenant scope
      const populatePromises = data.map(async (invoice) => {
        const scopedDb = (modelOrName) => {
          if (typeof modelOrName === 'string') return new FirestoreModel(modelOrName, invoice.tenantId)
          return modelOrName.forHospital(invoice.tenantId)
        }

        // Populate createdBy
        if (invoice.createdBy) {
          try {
            const userDoc = await User.findById(invoice.createdBy).select('name role email')
            if (userDoc) invoice.createdBy = userDoc
          } catch (e) { /* ignore */ }
        }

        // Populate items.medicine
        if (Array.isArray(invoice.items)) {
          const itemPromises = invoice.items.map(async (item) => {
            if (item.medicine) {
              try {
                const medId = (typeof item.medicine === 'object') ? (item.medicine._id || item.medicine.id) : item.medicine
                const MedicineModel = scopedDb(Medicine)
                const medDoc = await MedicineModel.findById(medId)
                if (medDoc) item.medicine = medDoc
              } catch (e) { /* ignore */ }
            }
          })
          await Promise.all(itemPromises)
        }
      })
      await Promise.all(populatePromises)
      return res.json(data)
    } else {
      const baseQuery = { tenantId: req.tenantId }
      const query = req.db(Invoice).find(baseQuery).sort({ createdAt: -1 })
      if (req.query.limit !== 'all') {
        query.limit(limit).skip(skip)
      }
      const data = await query.populate('items.medicine').populate('createdBy', 'name role email')
      return res.json(data)
    }
  } catch (e) { next(e) }
})

// Public/callback: mark invoice as paid (called by payment provider webhook or frontend after payment)
router.post('/:id/pay', async (req, res) => {
  try {
    const { id } = req.params
    const { provider, transactionId, amount, email } = req.body || {}
    const invoice = await req.db(Invoice).findById(id)
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' })
    invoice.paid = true
    invoice.payment = { provider: provider || 'manual', transactionId: transactionId || '', paidAt: new Date(), amount: Number(amount) || invoice.total }
    
    // Deduct stock if not already done (for normal medicines)
    if (!invoice.stockDeducted && Array.isArray(invoice.items)) {
      const medicineItems = invoice.items.filter(item => item.medicine)
      const medicineDocs = await Promise.all(medicineItems.map(item => {
        const medId = (typeof item.medicine === 'object') ? (item.medicine._id || item.medicine.id) : item.medicine
        return req.db(Medicine).findById(medId)
      }))
      
      const updatePromises = []
      medicineItems.forEach((item, index) => {
        const med = medicineDocs[index]
        if (med) {
          const medId = (typeof item.medicine === 'object') ? (item.medicine._id || item.medicine.id) : item.medicine
          const currentQty = Number(med.quantity) || 0
          const deductQty = Number(item.quantity) || Number(item.qty) || 0
          console.log(`[Invoices] Deducting ${deductQty} from ${med.name} (Current: ${currentQty})`)
          if (deductQty > 0) {
            updatePromises.push(Medicine.update(medId, { quantity: currentQty - deductQty }))
          }
        }
      })
      
      if (updatePromises.length > 0) {
        await Promise.all(updatePromises)
      }
      invoice.stockDeducted = true
    }

    await invoice.save()
    // Trigger PDF generation in background
    generateAndUploadInvoicePdf(invoice._id.toString(), req.tenantId || invoice.tenantId || invoice.tenant).catch(() => null)

    // send receipt email
    try {
      const tpl = invoicePaidTemplate(invoice)
      await sendEmail(email || invoice.createdBy?.email || '', `${process.env.COMPANY_NAME || 'HMS'} — Payment Receipt`, tpl.html, { attachments: tpl.attachments })
    } catch (e) { console.error('Failed to send receipt email', e) }
    // If this invoice appears to be a plan subscription, provision tenant and credentials
    try {
      const isPlan = invoice.plan || (invoice.items && invoice.items.length && String(invoice.items[0].description || '').toLowerCase().includes('plan subscription'))
      if (isPlan) {
        const { tenant, user, presetPassword } = await provisionTenantForInvoice(invoice)
        if (tenant) {
          // record tenant and credentials snapshot on the invoice
          const cred = { email: user.email, role: user.role, username: user.email, presetPassword, sentAt: new Date() }
          invoice.tenant = tenant._id
          invoice.credentialsSnapshot = invoice.credentialsSnapshot || []
          invoice.credentialsSnapshot.push(cred)
          await invoice.save()

          // send credentials email (include temporary password only in the email body here)
          try {
            const credentials = [{ role: user.role, username: user.email, password: presetPassword }]
            const tplCred = credentialsProvisionedTemplate(invoice, tenant, credentials)
            await sendEmail(user.email, `${process.env.COMPANY_NAME || 'HMS'} — Your Account Credentials`, tplCred.html, { attachments: tplCred.attachments })
          } catch (e) { console.error('Failed to send credentials email', e) }
        }
      }
    } catch (e) { console.error('[provision] error', e) }

    // If this invoice relates to a plan, compile receipt PDF and upload to Cloudinary in the background
    try {
      const isPlan = invoice.plan || (invoice.items && invoice.items.length && String(invoice.items[0].description || '').toLowerCase().includes('plan subscription'))
      if (isPlan) {
        await addPdfJob({
          invoiceId: invoice._id.toString(),
          tenantId: (req.tenantId || invoice.tenantId || invoice.tenant || '').toString(),
          paidAt: invoice.payment?.paidAt || new Date().toISOString()
        })
        console.log('[invoices] PDF generation job added to background queue')
      }
    } catch (e) {
      console.error('[invoices] Failed to queue PDF receipt generation:', e.message)
    }
    triggerBackgroundUpdate(req.tenantId || invoice.tenantId || invoice.tenant)
    return res.json({ ok: true, invoice })
  } catch (e) {
    console.error('[invoices] pay route error', e)
    return res.status(500).json({ error: 'Failed to mark paid' })
  }
})

// Get specific invoice: admin, owning patient, or public payment client
router.get('/:id', async (req, res) => {
  try {
    // 1. Resolve invoice across all tenants
    const resolved = await findInvoiceAcrossAllTenants(req.params.id)
    if (!resolved) return res.status(404).json({ error: 'Invoice not found' })

    // 2. Setup dynamic scoped DB context
    req.tenantId = resolved.tenantId
    req.db = (modelOrName) => {
      if (typeof modelOrName === 'string') return new FirestoreModel(modelOrName, req.tenantId)
      return modelOrName.forHospital(req.tenantId)
    }

    // 3. Fetch invoice with populated fields
    const invoice = await req.db(Invoice).findById(req.params.id).populate('items.medicine').populate('createdBy', 'name role email')
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' })

    // 4. Try to authenticate request if token is present
    const auth = req.headers.authorization || ''
    let token = (auth.startsWith('Bearer ') ? auth.slice(7) : null) || req.query.token || req.cookies?.token
    if (token && token.startsWith('Bearer ')) token = token.slice(7)

    let user = null
    if (token) {
      try {
        const accessSecret = process.env.ACCESS_TOKEN_SECRET
        if (accessSecret) {
          const payload = jwt.verify(token, accessSecret)
          user = await User.findById(payload.sub).select('name role email sessionId blocked')
          if (user && (!payload.sid || user.sessionId !== payload.sid || user.blocked)) {
            user = null
          }
        }
      } catch (tokenErr) {
        // Log token error but proceed as public client
      }
    }

    // 5. If authenticated, verify authorization
    if (user) {
      const isAdmin = user.role === 'admin'
      const isDirector = user.role === 'director'
      if (isAdmin || isDirector) return res.json(invoice)

      if (user.role === 'patient') {
        let allowed = false
        try {
          const patientDoc = user.email ? await req.db(Patient).findOne({ email: user.email }).select('_id') : null
          if (patientDoc && invoice.patient && String(invoice.patient) === String(patientDoc._id)) allowed = true
          if (!allowed && invoice.patientName === user.name) allowed = true
          if (!allowed) {
            const pr = await PaymentRequest.findOne({ invoice: invoice._id })
            if (pr) {
              if (pr.email && user.email && pr.email.toLowerCase() === user.email.toLowerCase()) allowed = true
              if (!allowed && patientDoc && pr.patient && String(pr.patient) === String(patientDoc._id)) allowed = true
            }
          }
        } catch (e) { console.error('[invoices] ownership check error', e) }

        if (allowed) return res.json(invoice)
      }
    }

    // 6. Public checkout client fallback (return safe, payment-only fields)
    const safeInvoice = {
      _id: invoice._id || invoice.id,
      id: invoice._id || invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      patientName: invoice.patientName,
      createdAt: invoice.createdAt,
      items: (invoice.items || []).map(it => ({
        description: it.description || it.medicine?.name || 'Item',
        unitPrice: Number(it.unitPrice ?? it.medicine?.sellingPrice ?? 0),
        quantity: Number(it.quantity || 1)
      })),
      total: Number(invoice.total || 0),
      paid: Boolean(invoice.paid)
    }
    return res.json(safeInvoice)
  } catch (e) {
    console.error('[invoices] get invoice error', e)
    res.status(500).json({ error: 'Server error' })
  }
})

// Generate PDF for invoice (admin or owning patient)
router.get('/:id/pdf', protect, async (req, res) => {
  try {
    const invoice = await req.db(Invoice).findById(req.params.id).populate('items.medicine')
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' })
    const user = await User.findById(req.userId).select('name role email')
    if (!user) return res.status(404).json({ error: 'User not found' })
    const isAdmin = user.role === 'admin'
    const isDirector = user.role === 'director'

    if (!isAdmin) {
      // For directors, allow if invoice belongs to their tenant
      if (isDirector && user.tenantId && (
        String(invoice.tenantId) === String(user.tenantId) ||
        String(invoice.tenant) === String(user.tenantId)
      )) {
        // allowed
      } else {
        let allowed = false
        try {
          const patientDoc = user.email ? await req.db(Patient).findOne({ email: user.email }).select('_id') : null
          if (patientDoc && invoice.patient && String(invoice.patient) === String(patientDoc._id)) allowed = true
          if (!allowed && invoice.patientName === user.name) allowed = true
          if (!allowed) {
            const pr = await PaymentRequest.findOne({ invoice: invoice._id })
            if (pr) {
              if (pr.email && user.email && pr.email.toLowerCase() === user.email.toLowerCase()) allowed = true
              if (!allowed && patientDoc && pr.patient && String(pr.patient) === String(patientDoc._id)) allowed = true
            }
          }
        } catch (e) { console.error('[invoices] pdf ownership check error', e) }
        if (!allowed) return res.status(403).json({ error: 'Forbidden' })
      }
    }

    // Buffer PDF instead of streaming directly to avoid write-after-end errors
    const doc = new PDFDocument({ margin: 50 })
    const chunks = []
    doc.on('data', (d) => chunks.push(d))
    doc.on('error', (err) => {
      console.error('PDF generation error', err)
      if (!res.headersSent) res.status(500).json({ error: 'PDF generation failed' })
    })
    doc.on('end', () => {
      const pdfData = Buffer.concat(chunks)
      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader('Content-Disposition', `inline; filename=invoice-${invoice.invoiceNumber || invoice._id}.pdf`)
      res.send(pdfData)
    })

    doc.fontSize(18).text('Invoice', { align: 'center' })
    doc.moveDown(0.5)
    doc.fontSize(12).text(`Invoice Number: ${invoice.invoiceNumber || invoice._id}`)
    doc.text(`Date: ${new Date(invoice.createdAt).toLocaleString()}`)
    doc.text(`Patient: ${invoice.patientName}`)
    if (invoice.doctorName) doc.text(`Doctor: ${invoice.doctorName}`)
    doc.moveDown()
    doc.fontSize(13).text('Items:')
    doc.moveDown(0.25)
    invoice.items.forEach(it => {
      // Defensive numeric coercion in case stored as strings or missing
      const num = (v) => {
        const n = Number(v)
        return Number.isFinite(n) ? n : 0
      }
      const unitPrice = num(it.unitPrice ?? it.medicine?.sellingPrice)
      const quantity = num(it.quantity)
      const gstRate = num(it.gstRate ?? it.medicine?.gstRate)
      const line = unitPrice * quantity
      const gst = line * (gstRate / 100)
      // Consider an item a consultation only when it has no medicine reference and description mentions consult
      const isConsult = (!it.medicine && /consult/i.test((it.description || '') + ''))
      if (isConsult) {
        const label = 'Consultation fees'
        doc.fontSize(11).text(`${label} :-------  x${quantity} @ ${unitPrice.toFixed(2)}  GST ${gstRate}%  Line ${(line + gst).toFixed(2)}`)
      } else {
        const name = it.medicine?.name || it.description || 'Item'
        doc.fontSize(11).text(`${name}  x${quantity} @ ${unitPrice.toFixed(2)}  GST ${gstRate}%  Line ${(line + gst).toFixed(2)}`)
      }
    })
    doc.moveDown()
    // Recalculate totals defensively if any are missing or not finite
    const safeSubtotal = Number.isFinite(invoice.subtotal) ? invoice.subtotal : invoice.items.reduce((acc, it) => {
      const unitPrice = Number(it.unitPrice) || Number(it.medicine?.sellingPrice) || 0
      const quantity = Number(it.quantity) || 0
      return acc + (unitPrice * quantity)
    }, 0)
    const safeGstTotal = Number.isFinite(invoice.gstTotal) ? invoice.gstTotal : invoice.items.reduce((acc, it) => {
      const unitPrice = Number(it.unitPrice) || Number(it.medicine?.sellingPrice) || 0
      const quantity = Number(it.quantity) || 0
      const gstRate = Number(it.gstRate) || Number(it.medicine?.gstRate) || 0
      const line = unitPrice * quantity
      return acc + (line * (gstRate / 100))
    }, 0)
    const safeTotal = Number.isFinite(invoice.total) ? invoice.total : (safeSubtotal + safeGstTotal)
    doc.fontSize(12).text(`Subtotal: ${safeSubtotal.toFixed(2)}`)
    doc.text(`GST: ${safeGstTotal.toFixed(2)}`)
    doc.text(`Total: ${safeTotal.toFixed(2)}`)
    doc.end()
  } catch (e) {
    console.error('PDF route failure', e)
    if (!res.headersSent) res.status(500).json({ error: 'PDF generation failed' })
  }
})

// Convert an existing invoice to a consultation-style invoice
// Allowed for admin or the owning patient. Body: { doctorName?: string }
router.patch('/:id/convert-to-consultation', protect, async (req, res) => {
  try {
    const invoice = await req.db(Invoice).findById(req.params.id)
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' })
    const user = await User.findById(req.userId).select('name role')
    if (!user) return res.status(404).json({ error: 'User not found' })
    const isAdmin = user.role === 'admin'
    const isOwner = user.role === 'patient' && invoice.patientName === user.name
    if (!isAdmin && !isOwner) return res.status(403).json({ error: 'Forbidden' })

    const { doctorName } = req.body || {}

    // Replace items with a single consultation line while preserving total amount
    const total = Number(invoice.total) || 0
    const newItem = { description: doctorName ? `Consultation with Dr. ${doctorName}` : 'Consultation', quantity: 1, unitPrice: total, gstRate: 0 }
    invoice.items = [newItem]
    invoice.subtotal = total
    invoice.gstTotal = 0
    invoice.total = total
    if (doctorName) invoice.doctorName = doctorName

    await invoice.save()
    res.json({ ok: true, invoice })
  } catch (e) {
    console.error('[invoices] convert-to-consultation error', e)
    res.status(500).json({ error: 'Failed to convert invoice' })
  }
})

// Admin: create invoice (billing action)
router.post('/', protect, allowRolesWithSubadminFeature(['admin', 'director', 'subadmin'], 'manage_invoices'), async (req, res) => {
  const { patientName, items, patient, email } = req.body
  if (!patientName || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Invalid payload' })
  }

  // Resolve patient ID
  let resolvedPatientId = patient || null
  if (!resolvedPatientId) {
    const searchEmail = email || req.body.patientEmail
    if (searchEmail) {
      const patientDoc = await req.db(Patient).findOne({ email: searchEmail.toLowerCase() }).select('_id')
      if (patientDoc) resolvedPatientId = patientDoc._id
    }
  }
  if (!resolvedPatientId && patientName) {
    const patientDoc = await req.db(Patient).findOne({ firstName: patientName }).select('_id')
    if (patientDoc) resolvedPatientId = patientDoc._id
  }

  // Validate items: not expired, sufficient stock
  try {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const medicineDocs = await Promise.all(items.map(item => 
      req.db(Medicine).findById(item.medicine).select('name expiryDate quantity')
    ))
    for (let idx = 0; idx < items.length; idx++) {
      const item = items[idx]
      const med = medicineDocs[idx]
      if (!med) return res.status(400).json({ error: 'Medicine not found' })
      if (med.expiryDate && med.expiryDate < today) {
        return res.status(400).json({ error: `Medicine "${med.name}" is expired and cannot be sold` })
      }
      if ((med.quantity || 0) < item.quantity) {
        return res.status(400).json({ error: `Insufficient stock for "${med.name}"` })
      }
    }
  } catch (e) {
    return res.status(500).json({ error: 'Validation failed' })
  }

  // Calculate prices and GST
  let subtotal = 0
  let gstTotal = 0
  for (const item of items) {
    const unitPrice = Number(item.unitPrice)
    const gstRate = Number(item.gstRate)
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      return res.status(400).json({ error: 'Invalid unitPrice in items' })
    }
    if (!Number.isFinite(gstRate) || gstRate < 0) {
      return res.status(400).json({ error: 'Invalid gstRate in items' })
    }
    const line = unitPrice * item.quantity
    const gst = line * (gstRate / 100)
    subtotal += line
    gstTotal += gst
  }
  const total = subtotal + gstTotal

  const invData = {
    patientName,
    patient: resolvedPatientId || undefined,
    items,
    subtotal,
    gstTotal,
    total,
    createdBy: req.userId,
    createdByRole: (req.user && req.user.role) || 'admin'
  }
  if (req.tenantId) invData.tenantId = req.tenantId
  const inv = req.db(Invoice)._wrap(invData)
  await inv.save()

  // Trigger PDF generation in background
  generateAndUploadInvoicePdf(inv._id.toString(), req.tenantId).catch(() => null)

  const populated = await inv.populate('items.medicine')
  triggerBackgroundUpdate(req.tenantId)
  res.status(201).json(populated)
})

export default router
