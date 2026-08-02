import { listAttendanceService, createAttendanceService } from '../services/attendanceService.js'

function handleError(res, error, defaultMessage) {
  const status = Number(error.status) || 500
  const isClientError = status >= 400 && status < 500
  const message = isClientError ? (error.publicMessage || error.message || defaultMessage) : defaultMessage
  if (!isClientError) {
    console.error('[attendanceController] internal error', { status, error: error.message })
  } else {
    console.warn('[attendanceController] client error', { status, error: message })
  }
  return res.status(status).json({ error: message })
}

export async function listAttendance(req, res) {
  try {
    const data = await listAttendanceService(req)
    return res.json(data)
  } catch (error) {
    return handleError(res, error, 'Failed to list attendance')
  }
}

export async function createAttendance(req, res) {
  try {
    const record = await createAttendanceService(req)
    return res.status(201).json(record)
  } catch (error) {
    return handleError(res, error, 'Failed to create attendance')
  }
}
