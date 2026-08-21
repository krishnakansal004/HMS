import express from 'express'
import Medicine from '../models/Medicine.js'
import Invoice from '../models/Invoice.js'
import Appointment from '../models/Appointment.js'
import Prescription from '../models/Prescription.js'
import QueueToken from '../models/QueueToken.js'
import Patient from '../models/Patient.js'
import { protect, doctor as doctorRole } from '../utils/auth.js'
import { loadTenant } from '../utils/saas.js'
import { allowRolesWithSubadminFeature } from '../utils/permissions.js'
import { istDateString, toIst } from '../utils/ist.js'
import CacheDashboard from '../models/CacheDashboard.js'
import CacheReports from '../models/CacheReports.js'
import CacheStatistics from '../models/CacheStatistics.js'
import { triggerBackgroundUpdate } from '../services/cacheService.js'
import { getCache } from '../utils/redis.js'

const router = express.Router()

router.get('/low-stock', protect, loadTenant, allowRolesWithSubadminFeature(['admin', 'subadmin', 'doctor'], 'view_reports'), async (req, res) => {
  try {
    if (!req.tenant) return res.json([])
    const threshold = Number(req.query.threshold || 10)
    const all = await req.db(Medicine).find({ })
    const filtered = all.filter(m => (m.quantity || 0) <= threshold).sort((a, b) => (a.quantity || 0) - (b.quantity || 0))
    res.json(filtered)
  } catch (e) {
    console.error('low-stock error', e)
    res.status(500).json({ error: 'Failed to load low stock medicines' })
  }
})

router.get('/expiry', protect, loadTenant, allowRolesWithSubadminFeature(['admin', 'subadmin', 'doctor'], 'view_reports'), async (req, res) => {
  try {
    if (!req.tenant) return res.json([])
    const days = Number(req.query.days || 30)
    const soon = new Date(Date.now() + days * 24 * 60 * 60 * 1000)
    const all = await req.db(Medicine).find({ })
    const filtered = all.filter(m => m.expiryDate && new Date(m.expiryDate) <= soon).sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate))
    res.json(filtered)
  } catch (e) {
    console.error('expiry error', e)
    res.status(500).json({ error: 'Failed to load expiring medicines' })
  }
})

// Monthly/Daily sales by medicine
router.get('/sales-monthly', protect, loadTenant, allowRolesWithSubadminFeature(['admin', 'subadmin'], 'view_reports'), async (req, res) => {
  try {
    if (!req.tenant) return res.json([])
    const tenantId = req.tenant?._id || req.user?.tenantId

    let data = await getCache(`hms:reports:${tenantId}`)
    if (!data) {
      const cacheDoc = await req.db(CacheReports).findOne({ type: 'reports_data' })
      data = cacheDoc?.data
    }
    if (data && data.salesMonthly) {
      let list = data.salesMonthly
      if (req.query.start) {
        const start = new Date(req.query.start)
        list = list.filter(m => new Date(m.month + '-01') >= start)
      }
      return res.json(list)
    }

    triggerBackgroundUpdate(tenantId)
    res.json([])
  } catch (e) {
    console.error('sales-monthly error', e)
    res.status(500).json({ error: 'Failed to build monthly sales' })
  }
})

// Full stock report (all active medicines) with basic fields
router.get('/stock-full', protect, loadTenant, allowRolesWithSubadminFeature(['admin', 'subadmin', 'doctor'], 'view_reports'), async (req, res) => {
  try {
    if (!req.tenant) return res.json([])
    const meds = await req.db(Medicine).find({ }).sort({ name: 1 })
    const list = meds.map(m => ({
      id: m._id,
      name: m.name,
      batch: m.batchNumber,
      expiryDate: m.expiryDate,
      quantity: m.quantity,
      reorderLevel: m.reorderLevel,
      gstRate: m.gstRate,
      purchasePrice: m.purchasePrice,
      sellingPrice: m.sellingPrice
    }))
    res.json(list)
  } catch (e) { res.status(500).json({ error: 'Failed to load stock' }) }
})

// Expiry soon (default 4 days) and already expired
router.get('/expiry-soon', protect, loadTenant, allowRolesWithSubadminFeature(['admin', 'subadmin', 'doctor'], 'view_reports'), async (req, res) => {
  try {
    if (!req.tenant) return res.json([])
    const days = Number(req.query.days || 4)
    const now = new Date()
    const cutoff = new Date(Date.now() + days * 24 * 60 * 60 * 1000)
    const all = await req.db(Medicine).find({ })
    const filtered = all.filter(m => m.expiryDate && new Date(m.expiryDate) <= cutoff).sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate))
    const formatted = filtered.map(m => ({
      id: m._id,
      name: m.name,
      batch: m.batchNumber,
      expiryDate: m.expiryDate,
      expired: new Date(m.expiryDate) < now,
      quantity: m.quantity
    }))
    res.json(formatted)
  } catch (e) { res.status(500).json({ error: 'Failed to load expiry data' }) }
})

// Dashboard summary: counts + today's sales
router.get('/dashboard-summary', protect, loadTenant, allowRolesWithSubadminFeature(['admin', 'subadmin', 'doctor'], 'view_reports'), async (req, res) => {
  try {
    if (!req.tenant) {
      return res.json({ totalPatients: 0, totalMedicines: 0, lowStockCount: 0, expiringSoonCount: 0, expiredCount: 0, todaySalesCount: 0, todaySalesTotal: 0 })
    }
    const tenantId = req.tenant._id

    let data = await getCache(`hms:dashboard:${tenantId}`)
    if (!data) {
      const cacheDoc = await req.db(CacheDashboard).findOne({ type: 'summary' })
      data = cacheDoc?.data
    }
    if (data) {
      return res.json(data)
    }

    triggerBackgroundUpdate(tenantId)
    res.json({
      totalPatients: 0,
      totalMedicines: 0,
      lowStockCount: 0,
      expiringSoonCount: 0,
      expiredCount: 0,
      todaySalesCount: 0,
      todaySalesTotal: 0,
      attendance: { present: 0, absent: 0, leave: 0, total: 0 },
      pendingLeaves: 0,
      hospitalName: req.tenant.name,
      hospitalSlug: req.tenant.slug
    })
  } catch (e) {
    console.error('dashboard-summary error', e)
    res.status(500).json({ error: 'Failed to load summary' })
  }
})

// Last 7 days sales (daily revenue)
router.get('/sales-last-7', protect, loadTenant, allowRolesWithSubadminFeature(['admin', 'subadmin'], 'view_reports'), async (req, res) => {
  try {
    if (!req.tenant) return res.json([])
    const tenantId = req.tenant._id

    let data = await getCache(`hms:reports:${tenantId}`)
    if (!data) {
      const cacheDoc = await req.db(CacheReports).findOne({ type: 'reports_data' })
      data = cacheDoc?.data
    }
    if (data && data.salesLast7) {
      return res.json(data.salesLast7)
    }

    triggerBackgroundUpdate(tenantId)
    // Return empty 7-day list
    const start = toIst(new Date()); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - 6)
    const days = []
    const cursor = new Date(start)
    for (let i = 0; i < 7; i++) {
      days.push({ day: istDateString(cursor), revenue: 0 })
      cursor.setDate(cursor.getDate() + 1)
    }
    res.json(days)
  } catch (e) {
    console.error('sales-last-7 error', e)
    res.status(500).json({ error: 'Failed to load last 7 days sales' })
  }
})

// Earnings aggregation by period (day|month|year)
// Query params: start=ISODate, end=ISODate, period=day|month|year
router.get('/earnings', protect, loadTenant, allowRolesWithSubadminFeature(['admin', 'subadmin'], 'view_reports'), async (req, res) => {
  try {
    const Invoice = (await import('../models/Invoice.js')).default
    const period = (req.query.period || 'day')
    const start = req.query.start ? new Date(req.query.start) : new Date(0)
    const end = req.query.end ? new Date(req.query.end) : new Date()
    const match = {}
    if (req.query.start || req.query.end) {
      match.createdAt = {}
      if (req.query.start) match.createdAt.$gte = start
      if (req.query.end) match.createdAt.$lte = end
    }
    const invoices = await req.db(Invoice).find(match)

    const map = {}
    for (const inv of invoices) {
      const dateVal = inv.payment?.paidAt || inv.createdAt
      if (!dateVal) continue
      const d = new Date(dateVal)
      if (d < start || d > end) continue

      let periodKey
      if (period === 'month') periodKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      else if (period === 'year') periodKey = `${d.getFullYear()}`
      else periodKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

      const rev = inv.payment?.amount || inv.total || 0
      map[periodKey] = (map[periodKey] || 0) + rev
    }

    // Helper to iterate periods and zero-fill
    const results = []
    if (period === 'month') {
      // iterate month by month from start to end (inclusive)
      const cur = new Date(start.getFullYear(), start.getMonth(), 1)
      const last = new Date(end.getFullYear(), end.getMonth(), 1)
      while (cur <= last) {
        const label = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`
        results.push({ period: label, revenue: Number((map[label] || 0).toFixed(2)) })
        cur.setMonth(cur.getMonth() + 1)
      }
    } else if (period === 'year') {
      const cur = new Date(start.getFullYear(), 0, 1)
      const last = new Date(end.getFullYear(), 0, 1)
      while (cur <= last) {
        const label = `${cur.getFullYear()}`
        results.push({ period: label, revenue: Number((map[label] || 0).toFixed(2)) })
        cur.setFullYear(cur.getFullYear() + 1)
      }
    } else {
      // day
      const cur = new Date(start.getFullYear(), start.getMonth(), start.getDate())
      const last = new Date(end.getFullYear(), end.getMonth(), end.getDate())
      while (cur <= last) {
        const y = cur.getFullYear()
        const m = String(cur.getMonth() + 1).padStart(2, '0')
        const d = String(cur.getDate()).padStart(2, '0')
        const label = `${y}-${m}-${d}`
        results.push({ period: label, revenue: Number((map[label] || 0).toFixed(2)) })
        cur.setDate(cur.getDate() + 1)
      }
    }

    res.json({ period, start: start.toISOString(), end: end.toISOString(), data: results })
  } catch (e) {
    console.error('earnings error', e)
    res.status(500).json({ error: 'Failed to compute earnings' })
  }
})

// Summary endpoint (legacy compatibility - same as dashboard-summary but minimal)
router.get('/summary', protect, loadTenant, allowRolesWithSubadminFeature(['admin', 'subadmin', 'doctor'], 'view_reports'), async (req, res) => {
  try {
    const [allMedicines, todayInvoices] = await Promise.all([
      req.db(Medicine).find({ }),
      req.db(Invoice).find({ createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) } })
    ])

    let lowStockCount = 0
    for (const m of allMedicines) {
      if (m.quantity <= (m.reorderLevel || 0)) lowStockCount++
    }

    res.json({
      totalMedicines: allMedicines.length,
      lowStockCount,
      todaySalesCount: todayInvoices.length,
      todaySalesTotal: Number(todayInvoices.reduce((s, i) => s + (i.total || 0), 0).toFixed(2))
    })
  } catch (e) { res.status(500).json({ error: 'Failed to load summary' }) }
})

// Weekly sales endpoint
router.get('/sales/weekly', protect, loadTenant, allowRolesWithSubadminFeature(['admin', 'subadmin'], 'view_reports'), async (req, res) => {
  try {
    if (!req.tenant) return res.json([])
    const start = toIst(new Date()); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - 6)
    const allInvoices = await req.db(Invoice).find({ createdAt: { $gte: start } })
    const map = {}
    for (const inv of allInvoices) {
      if (!inv.createdAt) continue
      const d = new Date(inv.createdAt)
      const label = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      map[label] = (map[label] || 0) + (inv.total || 0)
    }
    // Ensure missing days are zero-filled
    const days = []
    const cursor = new Date(start)
    for (let i = 0; i < 7; i++) {
      const label = istDateString(cursor)
      days.push({ day: label, revenue: map[label] || 0 })
      cursor.setDate(cursor.getDate() + 1)
    }
    res.json(days)
  } catch (e) {
    console.error('sales-weekly error', e)
    res.status(500).json({ error: 'Failed to load weekly sales' })
  }
})

// Daily sales endpoint
router.get('/sales/daily', async (req, res) => {
  try {
    const todayStart = toIst(new Date()); todayStart.setHours(0, 0, 0, 0)
    const todayEnd = toIst(new Date()); todayEnd.setHours(23, 59, 59, 999)
    const invoices = await req.db(Invoice).find({ createdAt: { $gte: todayStart, $lte: todayEnd } })
    const total = invoices.reduce((sum, inv) => sum + inv.total, 0)
    res.json({
      date: istDateString(todayStart),
      count: invoices.length,
      total: Number(total.toFixed(2))
    })
  } catch (e) { res.status(500).json({ error: 'Failed to load daily sales' }) }
})

export default router

// Doctor-centric dashboard metrics
// @route GET /api/reports/doctor-dashboard
// @access Private/Doctor
router.get('/doctor-dashboard', protect, doctorRole, async (req, res) => {
  try {
    const doctorId = req.userId
    const tenantId = req.tenantId

    let data = await getCache(`hms:statistics:doctor_${doctorId}:${tenantId}`)
    if (!data) {
      const cacheDoc = await req.db(CacheStatistics).findOne({ type: `doctor_dashboard_${doctorId}` })
      data = cacheDoc?.data
    }
    if (data) {
      return res.json(data)
    }

    triggerBackgroundUpdate(tenantId)
    res.json({
      counts: {
        todayAppointments: 0,
        next7Appointments: 0,
        patientsSeen30d: 0,
        pendingPrescriptions: 0,
        prescriptionsIssuedToday: 0,
        queueWaiting: 0
      },
      upcoming: [],
      pendingPrescriptions: [],
      queue: [],
      generatedAt: new Date()
    })
  } catch (e) {
    console.error('[doctor-dashboard] error', e)
    res.status(500).json({ error: 'Failed to build doctor dashboard' })
  }
})
