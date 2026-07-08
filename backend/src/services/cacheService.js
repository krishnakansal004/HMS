import CacheDashboard from '../models/CacheDashboard.js'
import CacheReports from '../models/CacheReports.js'
import CacheAnalytics from '../models/CacheAnalytics.js'
import CacheStatistics from '../models/CacheStatistics.js'
import Medicine from '../models/Medicine.js'
import Invoice from '../models/Invoice.js'
import Patient from '../models/Patient.js'
import Appointment from '../models/Appointment.js'
import Prescription from '../models/Prescription.js'
import QueueToken from '../models/QueueToken.js'
import DoctorAttendance from '../models/DoctorAttendance.js'
import LeaveRequest from '../models/LeaveRequest.js'
import User from '../models/User.js'
import Expense from '../models/Expense.js'
import Tenant from '../models/Tenant.js'
import Plan from '../models/Plan.js'
import AnalyticsSummary from '../models/AnalyticsSummary.js'
import LabOrder from '../models/LabOrder.js'
import { db } from '../config/firebase.js'
import { setCache } from '../utils/redis.js'

export async function updateDashboardCache(tenantId) {
  if (!tenantId) return
  try {
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
    const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999)

    const [medicines, todayInvoices, totalPatients] = await Promise.all([
      Medicine.forHospital(tenantId).find({}),
      Invoice.forHospital(tenantId).find({ createdAt: { $gte: todayStart, $lte: todayEnd } }),
      Patient.forHospital(tenantId).countDocuments({})
    ])

    let lowStockCount = 0
    let expiringSoonCount = 0
    let expiredCount = 0
    const now = new Date()
    const soon = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000)

    for (const m of medicines) {
      if (m.quantity <= (m.reorderLevel || 0)) lowStockCount++
      if (m.expiryDate) {
        const exp = new Date(m.expiryDate)
        if (exp < now) expiredCount++
        else if (exp <= soon) expiringSoonCount++
      }
    }

    const todaySalesTotal = todayInvoices.reduce((s, i) => s + (i.total || 0), 0)

    const todayStr = new Date().toISOString().split('T')[0]
    const attendanceRecords = await DoctorAttendance.forHospital(tenantId).find({ date: todayStr }).catch(() => [])
    let present = 0, absent = 0, leave = 0
    attendanceRecords.forEach(a => {
      if (a.status === 'present') present++
      else if (a.status === 'absent') absent++
      else if (a.status === 'leave') leave++
    })
    const attendanceStats = { present, absent, leave, total: attendanceRecords.length }

    const pendingLeaves = await LeaveRequest.forHospital(tenantId).countDocuments({ status: 'pending' }).catch(() => 0)

    const tenant = await Tenant.findById(tenantId).catch(() => null)

    const payload = {
      totalPatients,
      totalMedicines: medicines.length,
      lowStockCount,
      expiringSoonCount,
      expiredCount,
      todaySalesCount: todayInvoices.length,
      todaySalesTotal: Number(todaySalesTotal.toFixed(2)),
      attendance: attendanceStats,
      pendingLeaves,
      hospitalName: tenant ? tenant.name : '',
      hospitalSlug: tenant ? tenant.slug : '',
      updatedAt: new Date()
    }

    let cacheDoc = await CacheDashboard.forHospital(tenantId).findOne({ type: 'summary' })
    if (cacheDoc) {
      cacheDoc.data = payload
      await cacheDoc.save()
    } else {
      await CacheDashboard.forHospital(tenantId).create({ type: 'summary', data: payload, tenantId })
    }
    await setCache(`hms:dashboard:${tenantId}`, payload, 86400).catch(() => {})
    console.log(`[cacheService] Updated dashboard cache for tenant ${tenantId}`)
  } catch (e) {
    console.error(`[cacheService] updateDashboardCache error for tenant ${tenantId}:`, e)
  }
}

export async function updateReportsCache(tenantId) {
  if (!tenantId) return
  try {
    const startMonthly = new Date(); startMonthly.setFullYear(startMonthly.getFullYear() - 1); startMonthly.setDate(1)
    const medicines = await Medicine.forHospital(tenantId).find({})
    const invoices = await Invoice.forHospital(tenantId).find({ createdAt: { $gte: startMonthly } })

    const lowStock = medicines.filter(m => (m.quantity || 0) <= 10).sort((a, b) => (a.quantity || 0) - (b.quantity || 0))

    const soon30 = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    const expiring30 = medicines.filter(m => m.expiryDate && new Date(m.expiryDate) <= soon30).sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate))

    const soon4 = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000)
    const expiring4 = medicines.filter(m => m.expiryDate && new Date(m.expiryDate) <= soon4).sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate))

    const start7 = new Date(); start7.setHours(0, 0, 0, 0); start7.setDate(start7.getDate() - 6)
    const salesMap = {}
    for (const inv of invoices) {
      if (!inv.createdAt) continue
      const d = new Date(inv.createdAt)
      if (d < start7) continue
      const label = d.toISOString().split('T')[0]
      salesMap[label] = (salesMap[label] || 0) + (inv.total || 0)
    }
    const salesLast7 = []
    const cursor = new Date(start7)
    for (let i = 0; i < 7; i++) {
      const label = cursor.toISOString().split('T')[0]
      salesLast7.push({ day: label, revenue: Number((salesMap[label] || 0).toFixed(2)) })
      cursor.setDate(cursor.getDate() + 1)
    }

    const monthlyMap = {}
    for (const inv of invoices) {
      const d = inv.createdAt ? new Date(inv.createdAt) : null
      if (!d || d < startMonthly) continue
      if (!inv.items || !Array.isArray(inv.items)) continue

      const periodKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      for (const it of inv.items) {
        if (!it.medicine) continue
        const medId = String(it.medicine?._id || it.medicine?.id || it.medicine)
        const key = `${periodKey}_${medId}`
        if (!monthlyMap[key]) {
          monthlyMap[key] = { periodKey, medicineId: medId, name: it.description || 'Unknown', qty: 0, rev: 0 }
        }
        monthlyMap[key].qty += (it.quantity || 0)
        const gst = it.gstRate || 0
        monthlyMap[key].rev += ((it.quantity || 0) * (it.unitPrice || 0) * (1 + gst / 100))
      }
    }

    const medIds = [...new Set(Object.values(monthlyMap).map(m => m.medicineId))]
    const meds = []
    for (let i = 0; i < medIds.length; i += 10) {
      const chunk = medIds.slice(i, i + 10)
      const m = await Medicine.forHospital(tenantId).find({ _id: { $in: chunk } })
      meds.push(...m)
    }
    const medNameMap = Object.fromEntries(meds.map(m => [String(m._id), m.name]))

    const salesMonthly = Object.values(monthlyMap).map(m => ({
      month: m.periodKey,
      medicine: medNameMap[m.medicineId] || m.name,
      quantitySold: m.qty,
      revenue: Number(m.rev.toFixed(2))
    })).sort((a, b) => a.month.localeCompare(b.month) || a.medicine.localeCompare(b.medicine))

    const reportsPayload = {
      lowStock,
      expiring30,
      expiring4,
      salesLast7,
      salesMonthly,
      updatedAt: new Date()
    }

    let cacheDoc = await CacheReports.forHospital(tenantId).findOne({ type: 'reports_data' })
    if (cacheDoc) {
      cacheDoc.data = reportsPayload
      await cacheDoc.save()
    } else {
      await CacheReports.forHospital(tenantId).create({ type: 'reports_data', data: reportsPayload, tenantId })
    }
    await setCache(`hms:reports:${tenantId}`, reportsPayload, 86400).catch(() => {})
    console.log(`[cacheService] Updated reports cache for tenant ${tenantId}`)
  } catch (e) {
    console.error(`[cacheService] updateReportsCache error for tenant ${tenantId}:`, e)
  }
}

export async function compileAnalyticsCache(tenantId, nDays = 7) {
  if (!tenantId) return []
  try {
    const dateLimit = new Date()
    dateLimit.setDate(dateLimit.getDate() - (nDays + 1))
    dateLimit.setHours(0, 0, 0, 0)

    const [invoices, appointments, bedsSnap, labOrders, wardsSnap] = await Promise.all([
      Invoice.forHospital(tenantId).find({ createdAt: { $gte: dateLimit } }),
      Appointment.forHospital(tenantId).find({ slotStart: { $gte: dateLimit } }),
      db.collection('hospitals').doc(tenantId).collection('beds').get().catch(() => ({ docs: [] })),
      LabOrder.forHospital(tenantId).find({ createdAt: { $gte: dateLimit } }),
      db.collection('hospitals').doc(tenantId).collection('wards').get().catch(() => ({ docs: [] }))
    ])

    const beds = bedsSnap.docs.map(d => ({ _id: d.id, ...d.data() }))
    const totalBedsCount = beds.length || 10
    const occupiedBedsCount = beds.filter(b => b.isOccupied).length
    const occupancyRate = Number(((occupiedBedsCount / totalBedsCount) * 100).toFixed(1))

    const dateStrings = []
    for (let i = nDays - 1; i >= 0; i--) {
      const dateCursor = new Date()
      dateCursor.setDate(dateCursor.getDate() - i)
      dateStrings.push(dateCursor.toISOString().split('T')[0])
    }

    const existingSummaries = await AnalyticsSummary.forHospital(tenantId).find({ date: { $in: dateStrings } })
    const summariesMap = new Map(existingSummaries.map(s => [s.date, s]))

    const compiledList = []
    const savePromises = []

    for (let i = nDays - 1; i >= 0; i--) {
      const dateCursor = new Date()
      dateCursor.setDate(dateCursor.getDate() - i)
      const dateStr = dateCursor.toISOString().split('T')[0]

      const startOfDay = new Date(dateCursor); startOfDay.setHours(0, 0, 0, 0)
      const endOfDay = new Date(dateCursor); endOfDay.setHours(23, 59, 59, 999)

      const dayInvoices = invoices.filter(inv => {
        const d = inv.createdAt ? new Date(inv.createdAt) : null
        return d && d >= startOfDay && d <= endOfDay
      })
      const revenue = dayInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0)

      const dayAppointments = appointments.filter(app => {
        const d = app.slotStart ? new Date(app.slotStart) : null
        return d && d >= startOfDay && d <= endOfDay
      })
      const consultsCount = dayAppointments.length

      const docMap = {}
      dayAppointments.forEach(app => {
        const docName = app.doctorName || 'General Practice'
        docMap[docName] = (docMap[docName] || 0) + 1
      })
      const doctorStats = Object.entries(docMap).map(([name, count]) => ({ name, count }))

      let pharmacySales = 0
      dayInvoices.forEach(inv => {
        if (Array.isArray(inv.items)) {
          inv.items.forEach(it => {
            const desc = String(it.description || '').toLowerCase()
            if (desc.includes('medicine') || desc.includes('tab') || desc.includes('cap') || desc.includes('syr') || desc.includes('injection')) {
              pharmacySales += (it.unitPrice || 0) * (it.quantity || 1)
            }
          })
        }
      })

      const dayLabsCount = labOrders.filter(o => {
        const d = o.createdAt ? new Date(o.createdAt) : null
        return d && d >= startOfDay && d <= endOfDay
      }).length

      let summaryDoc = summariesMap.get(dateStr)

      const payload = {
        tenantId,
        date: dateStr,
        revenue: Number(revenue.toFixed(2)),
        consultsCount,
        occupancyRate,
        pharmacySales: Number(pharmacySales.toFixed(2)),
        labsCount: dayLabsCount,
        doctorStats,
        status: 'active'
      }

      if (summaryDoc) {
        summaryDoc.revenue = payload.revenue
        summaryDoc.consultsCount = payload.consultsCount
        summaryDoc.occupancyRate = payload.occupancyRate
        summaryDoc.pharmacySales = payload.pharmacySales
        summaryDoc.labsCount = payload.labsCount
        summaryDoc.doctorStats = payload.doctorStats
        savePromises.push(summaryDoc.save().then(doc => {
          compiledList.push(doc)
        }))
      } else {
        savePromises.push(AnalyticsSummary.forHospital(tenantId).create(payload).then(doc => {
          compiledList.push(doc)
        }))
      }
    }
    await Promise.all(savePromises)
    console.log(`[cacheService] Compiled AnalyticsSummary daily cache for tenant ${tenantId}`)
    return compiledList
  } catch (e) {
    console.error(`[cacheService] compileAnalyticsCache error for tenant ${tenantId}:`, e)
    return []
  }
}

export async function updateStatisticsCache(tenantId) {
  if (!tenantId) return
  try {
    const doctors = await User.find({ role: 'doctor', tenantId })
    const todayStr = new Date().toISOString().split('T')[0]
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
    const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999)
    const sevenDaysEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

    const doctorIds = doctors.map(doc => String(doc._id))
    
    // Batch query for all doctors in the tenant (index-free queries)
    const [allAppointments, allPrescriptions, allQueueTokens] = await Promise.all([
      Appointment.forHospital(tenantId).find({ slotStart: { $gte: thirtyDaysAgo } }),
      Prescription.forHospital(tenantId).find({}),
      QueueToken.forHospital(tenantId).find({ date: todayStr, status: 'waiting' })
    ])

    // Group items by doctor ID in memory
    const apptsByDoctor = {}
    const prescriptionsByDoctor = {}
    const queueByDoctor = {}

    doctorIds.forEach(id => {
      apptsByDoctor[id] = []
      prescriptionsByDoctor[id] = []
      queueByDoctor[id] = []
    })

    allAppointments.forEach(a => {
      const docId = String(a.doctor)
      if (apptsByDoctor[docId]) apptsByDoctor[docId].push(a)
    })

    allPrescriptions.forEach(p => {
      const docId = String(p.doctor)
      if (prescriptionsByDoctor[docId]) prescriptionsByDoctor[docId].push(p)
    })

    allQueueTokens.forEach(t => {
      const docId = String(t.doctor)
      if (queueByDoctor[docId]) queueByDoctor[docId].push(t)
    })

    for (const doc of doctors) {
      const doctorId = String(doc._id)
      const allDoctorAppointments = apptsByDoctor[doctorId] || []
      const allDoctorPrescriptions = prescriptionsByDoctor[doctorId] || []
      const queueWaitingToday = (queueByDoctor[doctorId] || []).slice(0, 100)

      const todaysAppointments = allDoctorAppointments.filter(a => {
        const d = a.slotStart ? new Date(a.slotStart) : null
        return d && d >= todayStart && d <= todayEnd
      })

      const upcoming7Appointments = allDoctorAppointments.filter(a => {
        const d = a.slotStart ? new Date(a.slotStart) : null
        return d && d > todayEnd && d <= sevenDaysEnd && ['scheduled', 'checked-in'].includes(a.status)
      }).slice(0, 25)

      const completed30Appointments = allDoctorAppointments.filter(a => {
        const d = a.slotStart ? new Date(a.slotStart) : null
        return d && d >= thirtyDaysAgo && d <= todayEnd && a.status === 'completed'
      })

      const pendingPrescriptions = allDoctorPrescriptions
        .filter(p => p.approvalStatus === 'pending')
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 10)

      const issuedTodayPrescriptions = allDoctorPrescriptions.filter(p => {
        const d = p.createdAt ? new Date(p.createdAt) : null
        return d && d >= todayStart && d <= todayEnd && p.pharmacyStatus === 'issued'
      })

      const uniquePatients30 = new Set(completed30Appointments.map(a => a.patientName)).size

      const docPayload = {
        counts: {
          todayAppointments: todaysAppointments.length,
          next7Appointments: upcoming7Appointments.length,
          patientsSeen30d: uniquePatients30,
          pendingPrescriptions: pendingPrescriptions.length,
          prescriptionsIssuedToday: issuedTodayPrescriptions.length,
          queueWaiting: queueWaitingToday.length
        },
        upcoming: todaysAppointments.concat(upcoming7Appointments)
          .sort((a, b) => new Date(a.slotStart) - new Date(b.slotStart))
          .slice(0, 10)
          .map(a => ({ id: a._id, at: a.slotStart, patientName: a.patientName, token: a.tokenNumber, status: a.status })),
        pendingPrescriptions: pendingPrescriptions.map(p => ({ id: p._id, createdAt: p.createdAt, patient: p.patient, status: p.approvalStatus })),
        queue: queueWaitingToday.map(t => ({ id: t._id, number: t.number, patientName: t.patientName, status: t.status })),
        updatedAt: new Date()
      }

      let cacheDoc = await CacheStatistics.forHospital(tenantId).findOne({ type: `doctor_dashboard_${doctorId}` })
      if (cacheDoc) {
        cacheDoc.data = docPayload
        await cacheDoc.save()
      } else {
        await CacheStatistics.forHospital(tenantId).create({ type: `doctor_dashboard_${doctorId}`, data: docPayload, tenantId })
      }
      await setCache(`hms:statistics:doctor_${doctorId}:${tenantId}`, docPayload, 86400).catch(() => {})
    }

    const adminsCount = await User.countDocuments({ role: 'admin' })
    const patientsCount = await User.countDocuments({ role: 'patient' })
    const doctorsCount = await User.countDocuments({ role: 'doctor' })
    const staffCount = await User.countDocuments({ role: 'staff' })

    const allTenants = await Tenant.find({})
    const allPlans = await Plan.find({})

    const plans = {}
    for (const p of allPlans) {
      plans[p._id || p.id] = { name: p.name, count: 0 }
    }
    for (const t of allTenants) {
      const pid = t.plan ? (typeof t.plan === 'object' ? t.plan._id || t.plan.id : t.plan) : null
      if (pid && plans[pid]) {
        plans[pid].count++
      }
    }

    const paidInvoicesSnapshot = await db.collectionGroup('invoices').where('paid', '==', true).get()
    const stats = paidInvoicesSnapshot.docs.reduce((acc, doc) => {
      const inv = doc.data()
      const a = Number(inv.payment?.amount || 0)
      const t = Number(inv.total || 0)
      let val = (t > a * 50) ? t : (a > 0 ? a : t)
      if (val > 0 && val < 50000) {
        val = Math.round(val * 100)
      }
      acc.count++
      acc.revenue += val
      return acc
    }, { count: 0, revenue: 0 })

    const allExpensesSnapshot = await db.collectionGroup('expenses').get()
    const totalExpenses = allExpensesSnapshot.docs.reduce((sum, doc) => sum + Number(doc.data().amount || 0), 0)

    const directorPayload = {
      admins: adminsCount,
      patients: patientsCount,
      doctors: doctorsCount,
      staff: staffCount,
      plans: Object.values(plans),
      activeSubscriptions: Object.values(plans).reduce((s, p) => s + p.count, 0),
      financials: {
        revenue: Number((stats.revenue / 100).toFixed(2)),
        expenses: Number(totalExpenses.toFixed(2)),
        profit: Number(((stats.revenue / 100) - totalExpenses).toFixed(2)),
        orderCount: stats.count
      },
      updatedAt: new Date()
    }

    let rootCacheDoc = await CacheStatistics.findOne({ type: 'director_stats' })
    if (rootCacheDoc) {
      rootCacheDoc.data = directorPayload
      await rootCacheDoc.save()
    } else {
      await CacheStatistics.create({ type: 'director_stats', data: directorPayload })
    }
    await setCache('hms:statistics:director', directorPayload, 86400).catch(() => {})
    console.log(`[cacheService] Updated statistics cache (doctors & director stats) for tenant ${tenantId}`)
  } catch (e) {
    console.error(`[cacheService] updateStatisticsCache error for tenant ${tenantId}:`, e)
  }
}

export async function updateAllCaches(tenantId) {
  if (!tenantId) return
  console.log(`[cacheService] Triggering cache updates for tenant ${tenantId}`)
  await Promise.all([
    updateDashboardCache(tenantId),
    updateReportsCache(tenantId),
    updateStatisticsCache(tenantId),
    compileAnalyticsCache(tenantId, 7)
  ])
}

// Background service compiler task helper (safe, fire-and-forget wrapper)
export function triggerBackgroundUpdate(tenantId) {
  if (!tenantId) return
  // Fire and forget: run asynchronously
  setTimeout(() => {
    updateAllCaches(tenantId).catch(err => {
      console.error(`[cacheService] Background update task failed for tenant ${tenantId}:`, err)
    })
  }, 10)
}
