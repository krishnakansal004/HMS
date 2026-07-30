import Invoice from '../models/Invoice.js'
import Appointment from '../models/Appointment.js'
import Bed from '../models/Bed.js'
import LabOrder from '../models/LabOrder.js'
import AnalyticsSummary from '../models/AnalyticsSummary.js'
import { istDateString } from '../utils/ist.js'

const VALID_INVOICE_STATUSES = ['paid', 'completed']
const PHARMACY_CATEGORY_KEYWORDS = ['pharm', 'medicine', 'drug', 'tablet', 'capsule', 'syrup', 'injection']

function getIstDateRange(dateString) {
  const startOfDay = new Date(`${dateString}T00:00:00.000+05:30`)
  const endOfDay = new Date(`${dateString}T23:59:59.999+05:30`)
  return { startOfDay, endOfDay }
}

function getDateStrings(nDays) {
  const dateStrings = []
  const now = new Date()
  for (let i = nDays - 1; i >= 0; i--) {
    const dateCursor = new Date(now)
    dateCursor.setDate(dateCursor.getDate() - i)
    dateStrings.push(istDateString(dateCursor))
  }
  return dateStrings
}

function normalizeDoctorKey(appointment) {
  const doctorId = appointment?.doctor?._id || appointment?.doctor?.id || (typeof appointment?.doctor === 'string' ? appointment.doctor : null)
  const name = appointment?.doctor?.name || appointment?.doctorName || 'General Practice'
  if (doctorId) return `id:${doctorId}`
  return `name:${String(name).trim().toLowerCase()}`
}

function isPharmacyItem(item) {
  const category = String(item?.category || item?.type || '').toLowerCase()
  const description = String(item?.description || '').toLowerCase()
  if (PHARMACY_CATEGORY_KEYWORDS.some((keyword) => category.includes(keyword))) return true
  if (PHARMACY_CATEGORY_KEYWORDS.some((keyword) => description.includes(keyword))) return true
  return false
}

export async function listAnalyticsSummaries(db, tenantId) {
  if (!tenantId) {
    const error = new Error('Tenant context is required to load analytics summaries')
    error.status = 403
    error.publicMessage = 'Tenant context is required'
    throw error
  }
  return db(AnalyticsSummary).find({ tenantId }).sort({ date: 1 })
}

export async function compileAnalyticsSummaries(db, tenantId, nDays = 7) {
  if (!tenantId) {
    const error = new Error('Tenant context is required to compile analytics summaries')
    error.status = 403
    error.publicMessage = 'Tenant context is required'
    throw error
  }

  const dateStrings = getDateStrings(nDays)
  const firstRange = getIstDateRange(dateStrings[0])
  const lastRange = getIstDateRange(dateStrings[dateStrings.length - 1])
  const analyticsModel = db(AnalyticsSummary).forHospital(tenantId)
  const [invoices, appointments, beds, labOrders, existingSummaries] = await Promise.all([
    db(Invoice).find({
      tenantId,
      createdAt: { $gte: firstRange.startOfDay, $lte: lastRange.endOfDay },
      status: { $in: VALID_INVOICE_STATUSES }
    }),
    db(Appointment).find({
      tenantId,
      slotStart: { $gte: firstRange.startOfDay, $lte: lastRange.endOfDay },
      status: { $ne: 'cancelled' }
    }),
    db(Bed).find({ tenantId }),
    db(LabOrder).find({
      tenantId,
      createdAt: { $gte: firstRange.startOfDay, $lte: lastRange.endOfDay }
    }),
    analyticsModel.find({ tenantId, date: { $in: dateStrings } })
  ])

  const invoiceByDate = new Map()
  const appointmentByDate = new Map()
  const doctorStatsByDate = new Map()
  const labCountByDate = new Map()
  const bedOccupancyByDate = new Map()
  const summariesMap = new Map(existingSummaries.map((s) => [s.date, s]))

  for (const dateStr of dateStrings) {
    invoiceByDate.set(dateStr, { revenue: 0, pharmacySales: 0 })
    appointmentByDate.set(dateStr, 0)
    doctorStatsByDate.set(dateStr, new Map())
    labCountByDate.set(dateStr, 0)
    bedOccupancyByDate.set(dateStr, new Set())
  }

  invoices.forEach((invoice) => {
    const invoiceDate = invoice.createdAt ? new Date(invoice.createdAt) : null
    if (!invoiceDate) return
    const dateStr = istDateString(invoiceDate)
    if (!invoiceByDate.has(dateStr)) return

    const invoiceDay = invoiceByDate.get(dateStr)
    invoiceDay.revenue += Number(invoice.total || 0)

    if (Array.isArray(invoice.items)) {
      invoice.items.forEach((item) => {
        if (isPharmacyItem(item)) {
          invoiceDay.pharmacySales += (item.unitPrice || 0) * (item.quantity || 1)
        }
      })
    }
  })

  appointments.forEach((appointment) => {
    const appointmentDate = appointment.slotStart ? new Date(appointment.slotStart) : null
    if (!appointmentDate) return
    const dateStr = istDateString(appointmentDate)
    if (!appointmentByDate.has(dateStr)) return

    appointmentByDate.set(dateStr, appointmentByDate.get(dateStr) + 1)

    const doctorKey = normalizeDoctorKey(appointment)
    const doctorMap = doctorStatsByDate.get(dateStr)
    const current = doctorMap.get(doctorKey) || { count: 0, name: appointment?.doctor?.name || appointment?.doctorName || 'General Practice' }
    doctorMap.set(doctorKey, { count: current.count + 1, name: current.name })
  })

  labOrders.forEach((order) => {
    const orderDate = order.createdAt ? new Date(order.createdAt) : null
    if (!orderDate) return
    const dateStr = istDateString(orderDate)
    if (!labCountByDate.has(dateStr)) return
    labCountByDate.set(dateStr, labCountByDate.get(dateStr) + 1)
  })

  beds.forEach((bed) => {
    if (!Array.isArray(bed.allocations) || bed.allocations.length === 0) return
    dateStrings.forEach((dateStr) => {
      const { startOfDay, endOfDay } = getIstDateRange(dateStr)
      const occupied = bed.allocations.some((allocation) => {
        const admitFrom = allocation.admitFrom ? new Date(allocation.admitFrom) : null
        const admitUntil = allocation.admitUntil ? new Date(allocation.admitUntil) : null
        if (!admitFrom) return false
        if (!admitUntil) return admitFrom <= endOfDay
        return admitFrom <= endOfDay && admitUntil >= startOfDay
      })
      if (occupied) {
        const occupancySet = bedOccupancyByDate.get(dateStr)
        occupancySet.add(bed._id || bed.id)
      }
    })
  })

  const batch = analyticsModel.collection.firestore.batch()
  const compiledList = []

  dateStrings.forEach((dateStr) => {
    const invoiceDay = invoiceByDate.get(dateStr)
    const consultsCount = appointmentByDate.get(dateStr)
    const labCount = labCountByDate.get(dateStr)
    const occupiedBeds = bedOccupancyByDate.get(dateStr).size
    const totalBedsCount = beds.length
    const occupancyRate = totalBedsCount > 0
      ? Number(((occupiedBeds / totalBedsCount) * 100).toFixed(1))
      : 0

    const doctorMap = doctorStatsByDate.get(dateStr)
    const doctorStats = Array.from(doctorMap.values()).map(({ name, count }) => ({ name, count }))

    const payload = {
      tenantId,
      date: dateStr,
      revenue: Number((invoiceDay.revenue || 0).toFixed(2)),
      consultsCount,
      occupancyRate,
      pharmacySales: Number((invoiceDay.pharmacySales || 0).toFixed(2)),
      labsCount: labCount,
      doctorStats,
      status: 'active',
      updatedAt: new Date()
    }

    const docId = `${tenantId}_${dateStr}`
    const summaryRef = analyticsModel.collection.doc(docId)
    batch.set(summaryRef, payload, { merge: true })

    const compiled = { _id: docId, id: docId, ...payload }
    compiledList.push(compiled)
  })

  try {
    await batch.commit()
  } catch (error) {
    console.error('[analyticsService] compileAnalyticsSummaries failed during batch commit:', error)
    throw error
  }

  return compiledList
}
