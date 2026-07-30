import {
  listAppointments as listAppointmentsService,
  getMyAppointments as getMyAppointmentsService,
  getSlotsAndQueue as getSlotsAndQueueService,
  getSlots as getSlotsService,
  createAppointment as createAppointmentService,
  updateAppointment as updateAppointmentService,
  hideAppointment as hideAppointmentService,
  cancelAppointment as cancelAppointmentService,
  bulkCancelAppointments as bulkCancelAppointmentsService,
  getAppointmentsByPatient as getAppointmentsByPatientService,
  getDoctorPatients as getDoctorPatientsService,
  listAppointmentPatients as listAppointmentPatientsService,
  getAppointmentById as getAppointmentByIdService
} from '../services/appointmentsService.js'

function handleError(res, error, defaultMessage) {
  const status = Number(error.status) || 500
  const isClientError = status >= 400 && status < 500
  const message = isClientError ? (error.publicMessage || error.message || defaultMessage) : defaultMessage
  if (!isClientError) {
    console.error('[appointmentsController] internal error', { status, error: error.message })
  } else {
    console.warn('[appointmentsController] client error', { status, error: message })
  }
  return res.status(status).json({ error: message })
}

export async function listAppointments(req, res) {
  try {
    const data = await listAppointmentsService(req)
    return res.json(data)
  } catch (error) {
    return handleError(res, error, 'Failed to list appointments')
  }
}

export async function getMyAppointments(req, res) {
  try {
    const data = await getMyAppointmentsService(req)
    return res.json(data)
  } catch (error) {
    return handleError(res, error, 'Failed to load your appointments')
  }
}

export async function getSlotsAndQueue(req, res) {
  try {
    const data = await getSlotsAndQueueService(req)
    return res.json(data)
  } catch (error) {
    return handleError(res, error, 'Failed to load slots and queue')
  }
}

export async function getSlots(req, res) {
  try {
    const data = await getSlotsService(req)
    return res.json(data)
  } catch (error) {
    return handleError(res, error, 'Failed to load slots')
  }
}

export async function createAppointment(req, res) {
  try {
    const appointment = await createAppointmentService(req)
    return res.status(201).json(appointment)
  } catch (error) {
    return handleError(res, error, 'Failed to create appointment')
  }
}

export async function updateAppointment(req, res) {
  try {
    const appointment = await updateAppointmentService(req)
    return res.json(appointment)
  } catch (error) {
    return handleError(res, error, 'Failed to update appointment')
  }
}

export async function hideAppointment(req, res) {
  try {
    const result = await hideAppointmentService(req)
    return res.json(result)
  } catch (error) {
    return handleError(res, error, 'Failed to hide appointment')
  }
}

export async function cancelAppointment(req, res) {
  try {
    const result = await cancelAppointmentService(req)
    return res.json(result)
  } catch (error) {
    return handleError(res, error, 'Failed to cancel appointment')
  }
}

export async function bulkCancelAppointments(req, res) {
  try {
    const result = await bulkCancelAppointmentsService(req)
    return res.json(result)
  } catch (error) {
    return handleError(res, error, 'Failed to bulk cancel appointments')
  }
}

export async function getAppointmentsByPatient(req, res) {
  try {
    const data = await getAppointmentsByPatientService(req)
    return res.json(data)
  } catch (error) {
    return handleError(res, error, 'Failed to list patient appointments')
  }
}

export async function getDoctorPatients(req, res) {
  try {
    const data = await getDoctorPatientsService(req)
    return res.json(data)
  } catch (error) {
    return handleError(res, error, 'Failed to list doctor patients')
  }
}

export async function listAppointmentPatients(req, res) {
  try {
    const data = await listAppointmentPatientsService(req)
    return res.json(data)
  } catch (error) {
    return handleError(res, error, 'Failed to list appointment patients')
  }
}

export async function getAppointmentById(req, res) {
  try {
    const appointment = await getAppointmentByIdService(req)
    return res.json(appointment)
  } catch (error) {
    return handleError(res, error, 'Failed to get appointment')
  }
}
