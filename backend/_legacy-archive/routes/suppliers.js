import express from 'express'
import Supplier from '../models/Supplier.js'
import { protect, admin } from '../utils/auth.js'
import { loadTenant, enforcePlanLimit } from '../utils/saas.js'
import { allowAdminOrFeature } from '../utils/permissions.js'

const router = express.Router()

// List suppliers for tenant
router.get('/', protect, allowAdminOrFeature('manage_suppliers'), loadTenant, async (req, res) => {
  const { q } = req.query
  const filter = q ? { name: { $regex: q, $options: 'i' } } : {}
  if (req.tenant) filter.tenantId = req.tenant._id
  const data = await req.db(Supplier).find(filter).sort({ name: 1 })
  res.json(data)
})

// Create supplier for tenant
router.post('/', protect, allowAdminOrFeature('manage_suppliers'), loadTenant, enforcePlanLimit('suppliers'), async (req, res) => {
  try {
    const payload = { ...req.body }
    if (req.tenant) payload.tenantId = req.tenant._id
    const doc = await req.db(Supplier).create(payload)
    res.status(201).json(doc)
  } catch (e) {
    if (e.code === 11000) return res.status(409).json({ error: 'Supplier already exists' })
    res.status(400).json({ error: e.message })
  }
})

// Update supplier (tenant scoped)
router.put('/:id', protect, allowAdminOrFeature('manage_suppliers'), loadTenant, async (req, res) => {
  try {
    const q = { _id: req.params.id }
    if (req.tenant) q.tenantId = req.tenant._id
    const doc = await req.db(Supplier).findOne(q)
    if (!doc) return res.status(404).json({ error: 'Not found' })
    const updated = await req.db(Supplier).update(doc._id, req.body)
    res.json(updated)
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})

// Delete supplier (tenant scoped)
router.delete('/:id', protect, allowAdminOrFeature('manage_suppliers'), loadTenant, async (req, res) => {
  const q = { _id: req.params.id }
  if (req.tenant) q.tenantId = req.tenant._id
  const doc = await req.db(Supplier).findOne(q)
  if (!doc) return res.status(404).json({ error: 'Not found' })
  await req.db(Supplier).delete(doc._id)
  res.json({ success: true })
})

export default router
