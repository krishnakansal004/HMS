import Attendance from '../models/Attendance.js'
import Staff from '../models/Staff.js'
import CacheAttendance from '../models/CacheAttendance.js'
import { getCache, setCache, delCache } from '../utils/redis.js'
import {
  getAttendanceTenantId,
  ensureAttendanceDb,
  invalidateAttendanceCaches
} from '../middlewares/attendanceMiddleware.js'

export async function listAttendanceService(req) {
  const { date, staffId, startDate, endDate } = req.query
  const q = {}
  const tenantId = getAttendanceTenantId(req)

  if (tenantId) q.tenantId = tenantId
  if (date) {
    q.date = date
  } else if (startDate || endDate) {
    q.date = {}
    if (startDate) q.date.$gte = startDate
    if (endDate) q.date.$lte = endDate
  }
  if (staffId) q.staff = staffId

  const limit = parseInt(req.query.limit, 10) || 0
  const skip = parseInt(req.query.skip, 10) || 0
  const cacheKey = `hms:attendance:list:${tenantId || ''}:${date || ''}:${staffId || ''}:${startDate || ''}:${endDate || ''}:${limit}:${skip}`

  ensureAttendanceDb(req, tenantId)

  let cached = await getCache(cacheKey)
  if (!cached) {
    const cacheDoc = await req.db(CacheAttendance).findOne({ type: cacheKey })
    if (cacheDoc && cacheDoc.data) {
      cached = cacheDoc.data
      await setCache(cacheKey, cached, 30).catch(() => {})
    }
  }
  if (cached) {
    return cached
  }

  let query = req.db(Attendance).find(q).populate('staff', 'name role').sort({ date: -1 })
  if (limit) query = query.skip(skip).limit(limit)

  const [total, items] = await Promise.all([
    req.db(Attendance).countDocuments(q),
    query
  ])

  const result = { items, total }
  await setCache(cacheKey, result, 30).catch(() => {})
  await req.db(CacheAttendance).deleteOne({ type: cacheKey }).catch(() => {})
  await req.db(CacheAttendance).create({ type: cacheKey, data: result, tenantId }).catch(() => {})
  return result
}

export async function createAttendanceService(req) {
  const { staff: staffId, date, status, checkInAt, checkOutAt, notes } = req.body || {}
  const tenantId = getAttendanceTenantId(req)

  ensureAttendanceDb(req, tenantId)

  const staffDoc = await req.db(Staff).findOne({ _id: staffId, ...(tenantId ? { tenantId } : {}) })
  if (!staffDoc) {
    const error = new Error('Staff not found for tenant')
    error.status = 404
    throw error
  }

  let record = await req.db(Attendance).findOne({ staff: staffId, date, ...(tenantId ? { tenantId } : {}) })
  if (!record) {
    record = req.db(Attendance)._wrap({ staff: staffId, date, tenantId })
  }

  if (status) record.status = status
  if (checkInAt) record.checkInAt = new Date(checkInAt)
  if (checkOutAt) record.checkOutAt = new Date(checkOutAt)
  if (notes) record.notes = notes
  await record.save()

  await invalidateAttendanceCaches(req, tenantId, date, staffId)
  return record
}
