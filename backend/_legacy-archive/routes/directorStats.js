import express from 'express'
import User from '../models/User.js'
import { protect, requireRoles } from '../utils/auth.js'
import { tenantMiddleware } from '../utils/tenant.js'
import { allowRolesWithSubadminFeature } from '../utils/permissions.js'
import Expense from '../models/Expense.js'
import CacheStatistics from '../models/CacheStatistics.js'
import { triggerBackgroundUpdate } from '../services/cacheService.js'
import { getCache } from '../utils/redis.js'

const router = express.Router()

// GET /api/director/stats
// Returns simple counts useful for the director dashboard.
router.get('/stats', protect, tenantMiddleware, allowRolesWithSubadminFeature(['director', 'admin', 'subadmin'], 'view_stats'), async (req, res) => {
  try {
    if (req.userRole === 'director') {
      let data = await getCache('hms:statistics:director')
      if (!data) {
        const cacheDoc = await CacheStatistics.findOne({ type: 'director_stats' })
        data = cacheDoc?.data
      }
      if (data) {
        return res.json(data)
      }
      triggerBackgroundUpdate(req.tenantId || 'global')
      return res.json({
        admins: 0, patients: 0, doctors: 0, staff: 0,
        plans: [],
        activeSubscriptions: 0,
        financials: {
          revenue: 0,
          expenses: 0,
          profit: 0,
          orderCount: 0
        }
      })
    } else {
      const tenantId = req.tenantId || req.user?.tenantId
      const tenantFilter = tenantId ? { tenantId } : {}
      const admins = await User.countDocuments({ role: 'admin', ...tenantFilter })
      const patients = await User.countDocuments({ role: 'patient', ...tenantFilter })
      const doctors = await User.countDocuments({ role: 'doctor', ...tenantFilter })
      const staff = await User.countDocuments({ role: 'staff', ...tenantFilter })
      res.json({ admins, patients, doctors, staff })
    }
  } catch (e) {
    console.error('director stats error', e)
    res.status(500).json({ error: 'Failed to compute stats' })
  }
})

// GET /api/director/tenants-usage
// Returns tenants with plan and subscription/payment details for director view
router.get('/tenants-usage', protect, requireRoles('director'), async (req, res) => {
  try {
    const Tenant = (await import('../models/Tenant.js')).default
    const Plan = (await import('../models/Plan.js')).default
    // fetch tenants; directors should be able to view all tenants
    const tenants = await Tenant.find({}).populate('plan').populate('director', 'name email')
    const out = tenants.map(t => ({
      id: t._id,
      name: t.name,
      director: t.director ? { id: t.director._id, name: t.director.name, email: t.director.email } : null,
      plan: t.plan ? { id: t.plan._id, name: t.plan.name } : null,
      subscriptionStart: t.subscriptionStart || null,
      subscriptionEnd: t.subscriptionEnd || null,
      paymentInfo: t.paymentInfo ? {
        ...t.paymentInfo,
        amountCents: (t.paymentInfo.amountCents > 0 && t.paymentInfo.amountCents < 50000) ? Math.round(t.paymentInfo.amountCents * 100) : t.paymentInfo.amountCents
      } : null,
      usage: t.usage || {},
      status: t.status
    }))
    res.json({ tenants: out })
  } catch (e) {
    console.error('tenants-usage error', e)
    res.status(500).json({ error: 'Failed to fetch tenants usage' })
  }
})

// Earnings and Expenses aggregation for director (global)
// GET /api/director/earnings?period=day|month|year&start=ISO&end=ISO&tenantId=
router.get('/earnings', protect, requireRoles('director'), async (req, res) => {
  try {
    const Invoice = (await import('../models/Invoice.js')).default
    const period = (req.query.period || 'day')
    const start = req.query.start ? new Date(req.query.start) : new Date(0)
    const end = req.query.end ? new Date(req.query.end) : new Date()

    const query = { paid: true }
    if (req.query.tenantId) query.tenantId = req.query.tenantId

    const invoices = await Invoice.find(query)
    const expenses = await Expense.find({})

    const revMap = {}
    const expMap = {}

    for (const inv of invoices) {
      const dateVal = inv.payment?.paidAt || inv.createdAt
      if (!dateVal) continue
      const d = new Date(dateVal)
      if (d < start || d > end) continue

      let periodKey
      if (period === 'month') periodKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      else if (period === 'year') periodKey = `${d.getFullYear()}`
      else periodKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

      const t = Number(inv.total || 0)
      const a = Number(inv.payment?.amount || 0)
      let rev = (t > a * 50) ? t : (a > 0 ? a : t)
      // Scale legacy Rupee amounts to Paise
      if (rev > 0 && rev < 50000) {
         rev = Math.round(rev * 100)
      }
      revMap[periodKey] = (revMap[periodKey] || 0) + (rev / 100)
    }

    for (const exp of expenses) {
      const d = new Date(exp.date || exp.createdAt)
      if (d < start || d > end) continue

      let periodKey
      if (period === 'month') periodKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      else if (period === 'year') periodKey = `${d.getFullYear()}`
      else periodKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

      const amt = Number(exp.amount || 0)
      expMap[periodKey] = (expMap[periodKey] || 0) + amt
    }

    const results = []
    let cur = new Date(start)
    if (period === 'month') cur.setDate(1)
    const limit = new Date(end)
    let safety = 0

    while (cur <= limit && safety < 1000) {
      safety++
      let label
      if (period === 'month') {
        label = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`
        const rev = Number((revMap[label] || 0).toFixed(2))
        const exp = Number((expMap[label] || 0).toFixed(2))
        results.push({ period: label, revenue: rev, expense: exp, profit: Number((rev - exp).toFixed(2)) })
        cur.setMonth(cur.getMonth() + 1)
      } else if (period === 'year') {
        label = `${cur.getFullYear()}`
        const rev = Number((revMap[label] || 0).toFixed(2))
        const exp = Number((expMap[label] || 0).toFixed(2))
        results.push({ period: label, revenue: rev, expense: exp, profit: Number((rev - exp).toFixed(2)) })
        cur.setFullYear(cur.getFullYear() + 1)
      } else {
        label = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`
        const rev = Number((revMap[label] || 0).toFixed(2))
        const exp = Number((expMap[label] || 0).toFixed(2))
        results.push({ period: label, revenue: rev, expense: exp, profit: Number((rev - exp).toFixed(2)) })
        cur.setDate(cur.getDate() + 1)
      }
    }

    res.json({ period, start: start.toISOString(), end: end.toISOString(), data: results })
  } catch (e) {
    console.error('[director/earnings] error', e)
    res.status(500).json({ error: 'Failed to compute earnings and expenses' })
  }
})

// Purchases list for director (global view). Query params: start, end
router.get('/purchases', protect, requireRoles('director'), async (req, res) => {
  try {
    const Purchase = (await import('../models/Purchase.js')).default
    const q = {}
    if (req.query.start || req.query.end) {
      const start = req.query.start ? new Date(req.query.start) : new Date(0)
      const end = req.query.end ? new Date(req.query.end) : new Date()
      q.purchasedAt = { $gte: start, $lte: end }
    }
    const list = await Purchase.find(q).sort({ purchasedAt: -1 })
    res.json(list)
  } catch (e) {
    console.error('[director/purchases] error', e)
    res.status(500).json({ error: 'Failed to load purchases' })
  }
})

export default router;
