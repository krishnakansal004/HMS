import express from 'express'
import CustomizationRequest from '../models/CustomizationRequest.js'
import { protect, requireRoles } from '../utils/auth.js'
import { loadTenant } from '../utils/saas.js'
import { allowRolesWithSubadminFeature } from '../utils/permissions.js'
import { sendEmail } from '../utils/notify.js'

const router = express.Router()

// Public: submit a customization request
router.post('/', loadTenant, async (req, res) => {
  try {
    const body = req.body || {}
    // Accept both legacy and modal field names. The Home modal sends: name,email,contact,address,description,purpose,priceRange,period,copiedText,agree
    const {
      title,
      name,
      description,
      requesterName,
      requesterEmail,
      email,
      requesterPhone,
      requesterAddress,
      address,
      company,
      purpose,
      priceRange,
      period,
      acceptanceText,
      copiedText,
      agree,
    } = body

    const finalTitle = title || `Customization request from ${name || requesterName || email || requesterEmail || 'user'}`
    if (!finalTitle) return res.status(400).json({ error: 'Title required' })

    const pr = {
      title: finalTitle,
      description,
      requesterName: requesterName || name || undefined,
      requesterEmail: requesterEmail || email || undefined,
      requesterPhone: requesterPhone || body.contact || undefined,
      company,
      requesterAddress: requesterAddress || address || undefined,
      purpose,
      priceRange,
      period,
      acceptanceText: acceptanceText || copiedText || undefined,
      agreed: typeof agree === 'boolean' ? agree : (body.agree === 'true')
    }
    // attach createdBy and tenantId if available
    if (req.userId) pr.createdBy = req.userId
    if (req.tenantId || (req.tenant && req.tenant._id)) pr.tenantId = req.tenantId || req.tenant._id
    const created = await req.db(CustomizationRequest).create(pr)

    // Notify requester by email of receipt
    try {
      const to = created.requesterEmail || null
      if (to) {
        const company = process.env.COMPANY_NAME || 'HMS'
        const subject = `${company}: Customization Request Received`
        const html = `
          <p>Dear ${created.requesterName || 'Customer'},</p>
          <p>Thank you for submitting a customization request titled <strong>${created.title}</strong>.</p>
          <p>This is to confirm that we have <strong>received</strong> your request. Our team will review the details and update you soon on the next steps.</p>
          <p>Regards,<br/>${company} Team</p>
        `
        await sendEmail(to, subject, html).catch(e => console.warn('customization request receipt email failed', e?.message || e))
      }
    } catch (e) {
      console.warn('failed to send customization request receipt email', e?.message || e)
    }

    res.status(201).json({ ok: true, customizationRequest: created })
  } catch (e) {
    console.error('submit customization request error', e)
    res.status(500).json({ error: 'Failed to submit' })
  }
})

// Director-only: list requests
router.get('/', protect, loadTenant, allowRolesWithSubadminFeature(['director','admin','subadmin'], 'view_customizations'), async (req, res) => {
  try {
    // Director may view all; admin/subadmin only see tenant requests
    const filter = {}
    if (req.user && req.user.role !== 'director') {
      const tid = req.tenantId || (req.tenant && req.tenant._id)
      if (tid) filter.tenantId = tid
    }
    const list = await req.db(CustomizationRequest).find(filter).sort({ createdAt: -1 })
    res.json({ requests: list })
  } catch (e) {
    console.error('customization request list error', e)
    res.status(500).json({ error: 'Failed to load' })
  }
})

// Director-only: update status
router.put('/:id/status', protect, loadTenant, allowRolesWithSubadminFeature(['director','admin','subadmin'], 'manage_customizations'), async (req, res) => {
  try {
    const { id } = req.params
    const { status } = req.body
    const { note } = req.body
    if (!['new', 'in_progress', 'completed', 'rejected'].includes(status)) return res.status(400).json({ error: 'Invalid status' })
    const cr = await req.db(CustomizationRequest).findById(id)
    if (!cr) return res.status(404).json({ error: 'Not found' })
    // Ensure tenant boundary for non-director
    if (req.user && req.user.role !== 'director') {
      const tid = req.tenantId || (req.tenant && req.tenant._id)
      if (!tid || String(cr.tenantId) !== String(tid)) return res.status(404).json({ error: 'Not found' })
    }
    const prev = cr.status
    cr.status = status
    await cr.save()

    // Notify requester by email when status changes to in_progress/completed/rejected
    try {
      const to = cr.requesterEmail || null
      if (to && ['in_progress', 'completed', 'rejected'].includes(status)) {
        const company = process.env.COMPANY_NAME || 'HMS'
        let subject = `${company}: Update on your customization request`
        let html = `<p>Dear ${cr.requesterName || 'Customer'},</p>`
        if (status === 'in_progress') {
          subject = `${company}: Your customization request is in progress`
          html += `<p>Your customization request titled <strong>${cr.title}</strong> is now <strong>in progress</strong>. We will notify you when it's completed.</p>`
          if (note) html += `<p>Note from clinic: ${note}</p>`
        } else if (status === 'completed') {
          subject = `${company}: Your customization request is completed`
          html += `<p>Your customization request titled <strong>${cr.title}</strong> has been <strong>completed</strong>. Our team may contact you for next steps.</p>`
          if (note) html += `<p>Note from clinic: ${note}</p>`
        } else if (status === 'rejected') {
          subject = `${company}: Your customization request was rejected`
          html += `<p>We are sorry to inform you that your customization request titled <strong>${cr.title}</strong> has been <strong>rejected</strong>.</p>`
          if (note) html += `<p>Reason: ${note}</p>`
          html += `<p>If you have questions, please reply or contact the clinic.</p>`
        }
        html += `<p>Regards,<br/>${company} Team</p>`
        await sendEmail(to, subject, html).catch(e => console.warn('customization request notify failed', e?.message || e))
      }
    } catch (e) {
      console.warn('failed to send customization request status email', e?.message || e)
    }

    res.json({ customizationRequest: cr })
  } catch (e) {
    console.error('customization request update error', e)
    res.status(500).json({ error: 'Failed to update' })
  }
})

export default router
