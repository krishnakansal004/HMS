import express from 'express'
import Query from '../models/Query.js'
import { protect, admin } from '../utils/auth.js'
import { allowRolesWithSubadminFeature } from '../utils/permissions.js'
import { sendEmail } from '../utils/notify.js'
import { queryStatusUpdateTemplate } from '../utils/emailTemplates.js'

const router = express.Router()

// List queries with optional status filter
router.get('/', protect, allowRolesWithSubadminFeature(['admin','director','subadmin'], 'manage_queries'), async (req, res) => {
  const { status } = req.query
  const where = {}
  if (status) where.status = status
  // Scope to tenant for non-director roles
  if (req.userRole !== 'director') {
    where.tenantId = req.tenantId
  }
  let items = await Query.find(where).sort({ createdAt: -1 })
  // Migrate legacy 'in-progress' to 'processing' on the fly
  const legacy = items.filter(i => i.status === 'in-progress')
  if (legacy.length) {
    await Promise.all(legacy.map(i => { i.status = 'processing'; return i.save() }))
    items = await Query.find(where).sort({ createdAt: -1 })
  }
  res.json(items)
})

// Update status
router.patch('/:id/status', protect, allowRolesWithSubadminFeature(['admin','director','subadmin'], 'manage_queries'), async (req, res) => {
  const { status } = req.body || {}
  if (!['new', 'processing', 'solved', 'closed'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' })
  }
  const existing = await Query.findById(req.params.id)
  if (!existing) return res.status(404).json({ error: 'Not found' })
  // enforce tenant boundary for non-directors
  if (req.userRole !== 'director') {
    if (!existing.tenantId) return res.status(404).json({ error: 'Not found' })
    if (String(existing.tenantId) !== String(req.tenantId)) return res.status(404).json({ error: 'Not found' })
  }
  const prev = existing.status
  existing.status = status
  await existing.save()
  // Best-effort email notification if status actually changed
  if (existing.email && prev !== status) {
    try {
      const { html, attachments } = queryStatusUpdateTemplate(existing, prev)
      await sendEmail(existing.email, `${process.env.COMPANY_NAME || 'PharmaPlus HMS'}: Query Status Updated`, html, attachments?.length ? { attachments } : undefined)
    } catch (e) {
      console.warn('query status email failed:', e?.message || e)
    }
  }
  res.json(existing)
})

export default router
