import express from 'express';
import Attendance from '../models/Attendance.js';
import { protect, admin } from '../utils/auth.js';
import { allowRolesWithSubadminFeature } from '../utils/permissions.js';
import tenantMiddleware from '../utils/tenant.js';
import Staff from '../models/Staff.js';
import { getCache, setCache, delCache } from '../utils/redis.js';
import CacheAttendance from '../models/CacheAttendance.js';

const router = express.Router();

// List attendance for a date, staff or a date range
router.get('/', protect, tenantMiddleware, async (req, res) => {
  const { date, staffId, startDate, endDate } = req.query;
  const q = {};
  if (req.tenant) q.tenantId = req.tenant._id
  if (date) {
    q.date = date;
  } else if (startDate || endDate) {
    q.date = {};
    if (startDate) q.date.$gte = startDate;
    if (endDate) q.date.$lte = endDate;
  }
  if (staffId) q.staff = staffId;
  // support pagination
  const limit = parseInt(req.query.limit, 10) || 0;
  const skip = parseInt(req.query.skip, 10) || 0;
  const tenantId = req.tenant?._id || req.user?.tenantId;

  const cacheKey = `hms:attendance:list:${tenantId}:${date || ''}:${staffId || ''}:${startDate || ''}:${endDate || ''}:${limit}:${skip}`;
  let cached = await getCache(cacheKey);
  if (!cached) {
    const cacheDoc = await req.db(CacheAttendance).findOne({ type: cacheKey })
    if (cacheDoc && cacheDoc.data) {
      cached = cacheDoc.data
      await setCache(cacheKey, cached, 30).catch(() => {})
    }
  }
  if (cached) {
    return res.json(cached);
  }

  let query = req.db(Attendance).find(q).populate('staff', 'name role').sort({ date: -1 });
  if (limit) query = query.skip(skip).limit(limit);

  const [total, items] = await Promise.all([
    req.db(Attendance).countDocuments(q),
    query
  ]);
  const result = { items, total };
  await setCache(cacheKey, result, 30).catch(() => {});
  await req.db(CacheAttendance).deleteOne({ type: cacheKey }).catch(() => {});
  await req.db(CacheAttendance).create({ type: cacheKey, data: result, tenantId }).catch(() => {});
  res.json(result);
});

// Mark attendance (admin/subadmin with permission)
router.post('/', protect, tenantMiddleware, allowRolesWithSubadminFeature(['admin','director','subadmin'], 'manage_attendance'), async (req, res) => {
  const staff = req.body.staff || req.body.staffId;
  const { date, status, checkInAt, checkOutAt, notes } = req.body;
  if (!staff || !date) return res.status(400).json({ error: 'staff and date required' });
  const tenantId = req.tenant ? req.tenant._id : (req.user ? req.user.tenantId : undefined)
  // ensure staff belongs to tenant
  const staffDoc = await req.db(Staff).findOne({ _id: staff, ...(tenantId ? { tenantId } : {}) })
  if (!staffDoc) return res.status(404).json({ error: 'Staff not found for tenant' })
  let record = await req.db(Attendance).findOne({ staff, date, ...(tenantId ? { tenantId } : {}) });
  if (!record) record = req.db(Attendance)._wrap({ staff, date, tenantId });
  if (status) record.status = status;
  if (checkInAt) record.checkInAt = new Date(checkInAt);
  if (checkOutAt) record.checkOutAt = new Date(checkOutAt);
  if (notes) record.notes = notes;
  await record.save();

  // Invalidate attendance list caches
  try {
    const listKeyPattern = `hms:attendance:list:${tenantId}:*`;
    // Since we can't scan keys easily, delete common keys or clear cache
    const cacheKeyAll = `hms:attendance:list:${tenantId}:${date}:::0:0`;
    const cacheKeyStaff = `hms:attendance:list:${tenantId}::${staff}::0:0`;
    await Promise.all([
      delCache(cacheKeyAll),
      delCache(cacheKeyStaff),
      req.db(CacheAttendance).deleteMany({ tenantId })
    ]);
  } catch (err) {
    console.warn('[attendance] failed to invalidate cache', err);
  }

  res.status(201).json(record);
});

export default router;
