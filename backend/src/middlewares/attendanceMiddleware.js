import Staff from "../models/Staff.js";
import Attendance from "../models/Attendance.js";
import CacheAttendance from "../models/CacheAttendance.js";
import FirestoreModel from "../models/firestore/FirestoreModel.js";

export function validateAttendanceQuery(req, res, next) {
  const { date, staffId, startDate, endDate } = req.query;

  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res
      .status(400)
      .json({ error: "Invalid date format, expected YYYY-MM-DD" });
  }
  if (startDate && !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
    return res
      .status(400)
      .json({ error: "Invalid startDate format, expected YYYY-MM-DD" });
  }
  if (endDate && !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
    return res
      .status(400)
      .json({ error: "Invalid endDate format, expected YYYY-MM-DD" });
  }
  if (date && (startDate || endDate)) {
    return res
      .status(400)
      .json({ error: "Use either date or a date range, not both" });
  }

  if (staffId && typeof staffId !== "string") {
    return res.status(400).json({ error: "Invalid staffId" });
  }

  return next();
}

export function validateAttendancePayload(req, res, next) {
  const { staff, date } = req.body || {};

  if (!staff || !date) {
    return res.status(400).json({ error: "staff and date required" });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res
      .status(400)
      .json({ error: "Invalid date format, expected YYYY-MM-DD" });
  }
  return next();
}

export function getAttendanceTenantId(req) {
  return req.tenant?._id || req.user?.tenantId || null;
}

export function ensureAttendanceDb(req, tenantId) {
  if (req.db) return req.db;
  req.db = (modelOrName) => {
    const actualTenantId = tenantId || null;
    if (typeof modelOrName === "string") {
      return new FirestoreModel(modelOrName, actualTenantId);
    }
    return modelOrName.forHospital(actualTenantId);
  };
  return req.db;
}

export async function ensureAttendanceTenantContext(req, res, next) {
  const tenantId = getAttendanceTenantId(req);
  ensureAttendanceDb(req, tenantId);
  if (!tenantId) {
    return next();
  }

  const staffId = req.body?.staff || req.body?.staffId || req.query?.staffId;
  if (staffId) {
    try {
      const staffDoc = await req.db(Staff).findOne({ _id: staffId, tenantId });
      if (!staffDoc) {
        return res.status(404).json({ error: "Staff not found for tenant" });
      }
    } catch (error) {
      console.warn(
        "[attendanceMiddleware] staff lookup failed",
        error?.message || error,
      );
    }
  }

  return next();
}

export async function ensureAttendanceRecordScope(req, res, next) {
  const tenantId = getAttendanceTenantId(req);
  ensureAttendanceDb(req, tenantId);
  if (req.params?.id) {
    try {
      const existing = await req.db(Attendance).findById(req.params.id);
      const record = await existing;
      if (!record) {
        return res.status(404).json({ error: "Attendance record not found" });
      }
      if (tenantId && String(record.tenantId) !== String(tenantId)) {
        return res.status(403).json({ error: "Forbidden tenant mismatch" });
      }
    } catch (error) {
      console.warn(
        "[attendanceMiddleware] record scope validation failed",
        error?.message || error,
      );
    }
  }
  return next();
}

export async function invalidateAttendanceCaches(req, tenantId, date, staffId) {
  try {
    const listKeyPattern = `hms:attendance:list:${tenantId}:*`;
    const cacheKeyAll = `hms:attendance:list:${tenantId}:${date || ""}:::0:0`;
    const cacheKeyStaff = `hms:attendance:list:${tenantId}::${staffId || ""}::0:0`;
    await Promise.all([
      req.db(CacheAttendance).deleteMany({ tenantId }),
      req.db(CacheAttendance).deleteOne({ type: cacheKeyAll }),
      req.db(CacheAttendance).deleteOne({ type: cacheKeyStaff }),
    ]);
    return { listKeyPattern, cacheKeyAll, cacheKeyStaff };
  } catch (error) {
    console.warn("[attendance] failed to invalidate cache", error);
    return null;
  }
}
