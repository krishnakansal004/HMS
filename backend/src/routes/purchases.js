import express from 'express'
import Purchase from '../models/Purchase.js'
import Medicine from '../models/Medicine.js'
import { protect, admin } from '../utils/auth.js'
import { loadTenant, enforcePlanLimit } from '../utils/saas.js'
import { allowAdminOrFeature } from '../utils/permissions.js'

const router = express.Router()

// GET purchases for tenant
router.get('/', protect, allowAdminOrFeature('view_purchases'), loadTenant, async (req, res) => {
  try {
    const q = {}
    if (req.tenant) q.tenantId = req.tenant._id
    console.log(`[Purchases Route] Fetching for tenant: ${req.tenant?._id || 'global'}`)
    const data = await req.db(Purchase).find(q).populate('supplier').populate('items.medicine').sort({ createdAt: -1 })
    res.json(data)
  } catch (error) {
    console.error('[Purchases Route] Error:', error)
    res.status(500).json({ error: 'Failed to fetch purchases' })
  }
})

// Create purchase for tenant
router.post('/', protect, allowAdminOrFeature('manage_purchases'), loadTenant, enforcePlanLimit('purchases'), async (req, res) => {
  const { supplier, items, status } = req.body
  if (!supplier || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Invalid payload' })
  }
  const totalCost = items.reduce((sum, i) => sum + i.quantity * i.unitCost, 0)
  const purchase = await req.db(Purchase).create({ supplier, items, totalCost, status, })

  // Update stock quantities if purchase is completed
  if (purchase.status === 'Completed') {
    const medDocs = await Promise.all(items.map(item => req.db(Medicine).findById(item.medicine)))
    const updatePromises = []
    items.forEach((item, index) => {
      const med = medDocs[index]
      if (med) {
        updatePromises.push(Medicine.update(med._id, { quantity: (med.quantity || 0) + item.quantity }))
      }
    })
    if (updatePromises.length > 0) {
      await Promise.all(updatePromises)
    }
  }

  const populated = await req.db(Purchase).findById(purchase._id).populate('supplier').populate('items.medicine')
  res.status(201).json(populated)
})

// Update purchase status (tenant-scoped)
router.put('/:id/status', protect, allowAdminOrFeature('manage_purchases'), loadTenant, async (req, res) => {
  try {
    const { status } = req.body
    const q = { _id: req.params.id }
    if (req.tenant) q.tenantId = req.tenant._id
    const purchase = await req.db(Purchase).findOne(q)
    if (!purchase) return res.status(404).json({ error: 'Purchase not found' })

    const oldStatus = purchase.status
    purchase.status = status
    await purchase.save()

    // Adjust stock if status changes to or from 'Completed'
    if (oldStatus !== 'Completed' && status === 'Completed') {
      const medDocs = await Promise.all(purchase.items.map(item => req.db(Medicine).findById(item.medicine)))
      const updatePromises = []
      purchase.items.forEach((item, index) => {
        const med = medDocs[index]
        if (med) {
          updatePromises.push(Medicine.update(med._id, { quantity: (med.quantity || 0) + item.quantity }))
        }
      })
      if (updatePromises.length > 0) await Promise.all(updatePromises)
    } else if (oldStatus === 'Completed' && status !== 'Completed') {
      const medDocs = await Promise.all(purchase.items.map(item => req.db(Medicine).findById(item.medicine)))
      const updatePromises = []
      purchase.items.forEach((item, index) => {
        const med = medDocs[index]
        if (med) {
          updatePromises.push(Medicine.update(med._id, { quantity: (med.quantity || 0) - item.quantity }))
        }
      })
      if (updatePromises.length > 0) await Promise.all(updatePromises)
    }

    const updatedPurchase = await req.db(Purchase).findById(req.params.id).populate('supplier').populate('items.medicine')
    res.json(updatedPurchase)
  } catch (e) {
    res.status(500).json({ error: 'Server error' })
  }
})

export default router
