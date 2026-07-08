import express from 'express'
import Medicine from '../models/Medicine.js'
import tenantMiddleware from '../utils/tenant.js'

// All medicine operations are tenant-scoped

const router = express.Router()

import { protect } from '../utils/auth.js'

// List with basic filters
router.get('/', protect, tenantMiddleware, async (req, res) => {
  try {
    const { q } = req.query
    const filter = {}
    if (req.tenant) filter.tenantId = req.tenant._id
    
    const limit = Number(req.query.limit) || 100
    const page = Number(req.query.page) || 1
    const skip = (page - 1) * limit

    let medicines
    if (q) {
      // Fetch all to allow in-memory text search fallback
      medicines = await req.db(Medicine).find(filter).populate('supplier').sort({ createdAt: -1 })
      const lowerQ = q.toLowerCase()
      medicines = medicines.filter(m => 
        (m.name && m.name.toLowerCase().includes(lowerQ)) || 
        (m.batchNumber && m.batchNumber.toLowerCase().includes(lowerQ))
      )
      // Slice in memory
      if (req.query.limit !== 'all') {
        medicines = medicines.slice(skip, skip + limit)
      }
    } else {
      // Query with database pagination
      const query = req.db(Medicine).find(filter).populate('supplier').sort({ createdAt: -1 })
      if (req.query.limit !== 'all') {
        query.limit(limit).skip(skip)
      }
      medicines = await query
    }
    
    res.json(medicines)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Server error' })
  }
})

// Create
router.post('/', protect, tenantMiddleware, async (req, res) => {
  try {
    const tenantId = req.tenant ? req.tenant._id : undefined
    const payload = { ...req.body, tenantId }
    const doc = await req.db(Medicine).create(payload)
    res.status(201).json(doc)
  } catch (e) {
    if (e.code === 11000) return res.status(409).json({ error: 'Medicine with this batch already exists' })
    res.status(400).json({ error: e.message })
  }
})

// Update
router.put('/:id', protect, tenantMiddleware, async (req, res) => {
  try {
    const tenantId = req.tenant ? req.tenant._id : undefined
    const filter = { _id: req.params.id, ...(tenantId ? { tenantId } : {}) }
    const doc = await req.db(Medicine).findOne(filter)
    if (!doc) return res.status(404).json({ error: 'Not found' })
    const updated = await req.db(Medicine).update(req.params.id, req.body)
    res.json(updated)
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})

// Delete
router.delete('/:id', protect, tenantMiddleware, async (req, res) => {
  const tenantId = req.tenant ? req.tenant._id : undefined
  const filter = { _id: req.params.id, ...(tenantId ? { tenantId } : {}) }
  const doc = await req.db(Medicine).findOne(filter)
  if (!doc) return res.status(404).json({ error: 'Not found' })
  await req.db(Medicine).delete(req.params.id)
  res.json({ success: true })
})

export default router
