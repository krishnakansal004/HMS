import express from 'express'
import ChatModel from '../models/ChatModel.js'
import { protect } from '../utils/auth.js'
import { loadTenant } from '../utils/saas.js'
import { allowRolesWithSubadminFeature } from '../utils/permissions.js'

const router = express.Router()

// Public GET: list or get model for a role
router.get('/', loadTenant, async (req, res) => {
  try {
    const role = (req.query.role || '').toString().toLowerCase()
    const tenantId = req.tenantId || (req.tenant && req.tenant._id) || null
    // Build OR clauses: include global models (tenantId null/not set) and tenant-specific when tenant present
    const globalClauses = [{ tenantId: null }, { tenantId: { $exists: false } }]
    const orClause = tenantId ? [{ tenantId }, ...globalClauses] : globalClauses
    if (role) {
      const doc = await ChatModel.findOne({ role, $or: orClause })
      return res.json(doc ? [doc] : [])
    }
    const docs = await ChatModel.find({ $or: orClause }).sort({ role: 1, createdAt: -1 })
    return res.json(docs)
  } catch (e) {
    console.error('chat-models:get', e)
    return res.status(500).json({ error: 'Failed to list chat models' })
  }
})

// Admin/subadmin CRUD (tenant admins manage tenant models; director/admin can create global models)
router.post('/', protect, loadTenant, allowRolesWithSubadminFeature(['admin', 'subadmin'], 'manage_chat_models'), async (req, res) => {
  try {
    const { name, role, systemPrompt, keywords } = req.body
    if (!name || !role) return res.status(400).json({ error: 'name and role required' })
    const tenantId = req.tenantId || (req.tenant && req.tenant._id) || null
    const doc = await ChatModel.create({ name, role: role.toString().toLowerCase(), systemPrompt: systemPrompt || '', keywords: Array.isArray(keywords) ? keywords : [], createdBy: req.userId, tenantId })
    return res.json(doc)
  } catch (e) {
    console.error('chat-models:create', e)
    return res.status(500).json({ error: 'Failed to create chat model' })
  }
})

router.put('/:id', protect, loadTenant, allowRolesWithSubadminFeature(['admin', 'subadmin'], 'manage_chat_models'), async (req, res) => {
  try {
    const { id } = req.params
    const { name, role, systemPrompt, keywords } = req.body
    let doc = await ChatModel.findById(id)
    if (!doc) return res.status(404).json({ error: 'Not found' })
    doc = await ChatModel.update(id, { name, role: role && role.toString().toLowerCase(), systemPrompt, keywords: Array.isArray(keywords) ? keywords : [] })
    // Ensure tenant boundary: non-director callers may only edit tenant models
    const tenantId = req.tenantId || (req.tenant && req.tenant._id)
    if (doc.tenantId && tenantId && String(doc.tenantId) !== String(tenantId) && req.user.role !== 'director') {
      return res.status(404).json({ error: 'Not found' })
    }
    if (!doc.tenantId && req.user.role !== 'director') {
      // non-director cannot edit global models
      return res.status(403).json({ error: 'Forbidden' })
    }
    return res.json(doc)
  } catch (e) {
    console.error('chat-models:update', e)
    return res.status(500).json({ error: 'Failed to update chat model' })
  }
})

router.delete('/:id', protect, loadTenant, allowRolesWithSubadminFeature(['admin', 'subadmin'], 'manage_chat_models'), async (req, res) => {
  try {
    const { id } = req.params
    const doc = await ChatModel.findById(id)
    if (!doc) return res.status(404).json({ error: 'Not found' })
    const tenantId = req.tenantId || (req.tenant && req.tenant._id)
    if (doc.tenantId && tenantId && String(doc.tenantId) !== String(tenantId) && req.user.role !== 'director') {
      return res.status(404).json({ error: 'Not found' })
    }
    if (!doc.tenantId && req.user.role !== 'director') {
      return res.status(403).json({ error: 'Forbidden' })
    }
    await ChatModel.delete(id)
    return res.json({ ok: true })
  } catch (e) {
    console.error('chat-models:delete', e)
    return res.status(500).json({ error: 'Failed to delete chat model' })
  }
})

export default router
