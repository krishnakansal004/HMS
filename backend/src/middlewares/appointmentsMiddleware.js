import FirestoreModel from '../models/firestore/FirestoreModel.js'
import User from '../models/User.js'

const DOCTOR_ID_REGEX = /^[a-zA-Z0-9_\-]{15,40}$/

export function validateDoctorAndDateQuery(req, res, next) {
  const { doctorId, date } = req.query
  if (!doctorId || !date) {
    return res.status(400).json({ error: 'doctorId and date required' })
  }
  if (!DOCTOR_ID_REGEX.test(doctorId)) {
    return res.status(400).json({ error: 'Invalid doctorId' })
  }
  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(date) || isNaN(new Date(date).getTime())) {
    return res.status(400).json({ error: 'Invalid date format, expected YYYY-MM-DD' })
  }
  return next()
}

export function validateBulkCancelPayload(req, res, next) {
  const { doctorId, startDate, endDate } = req.body
  if (!doctorId || !startDate || !endDate) {
    return res.status(400).json({ error: 'doctorId, startDate, endDate required' })
  }
  if (!DOCTOR_ID_REGEX.test(doctorId)) {
    return res.status(400).json({ error: 'Invalid doctorId' })
  }
  if (isNaN(new Date(startDate).getTime()) || isNaN(new Date(endDate).getTime())) {
    return res.status(400).json({ error: 'Invalid dates' })
  }
  return next()
}

export function validatePatientIdQuery(req, res, next) {
  const { patientId } = req.query
  if (!patientId) {
    return res.status(400).json({ error: 'patientId required' })
  }
  return next()
}

export function getTenantId(req) {
  return req.tenant?._id || req.user?.tenantId
}

export function validateDoctorId(doctorId) {
  return typeof doctorId === 'string' && DOCTOR_ID_REGEX.test(doctorId)
}

export async function resolveDoctorTenantId(doctorId) {
  if (!doctorId) return null
  try {
    const docUser = await User.findById(doctorId).select('tenantId')
    return docUser?.tenantId || null
  } catch (_) {
    return null
  }
}

export function ensureRequestDb(req, tenantId) {
  if (req.db) return req.db
  req.db = (modelOrName) => {
    const actualTenantId = tenantId || null
    if (typeof modelOrName === 'string') {
      return new FirestoreModel(modelOrName, actualTenantId)
    }
    return modelOrName.forHospital(actualTenantId)
  }
  return req.db
}

export async function ensureRequestDbForDoctor(req, res, next) {
  if (req.db) return next()

  const doctorId = req.query.doctorId || req.body.doctorId
  let tenantId = getTenantId(req) || null

  if (!tenantId && doctorId) {
    tenantId = await resolveDoctorTenantId(doctorId)
  }

  ensureRequestDb(req, tenantId)
  return next()
}
