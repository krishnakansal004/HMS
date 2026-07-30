import Patient from '../models/Patient.js'
import AbdmConsent from '../models/AbdmConsent.js'

const DEFAULT_DATA_TYPES = ['OPD', 'Prescription', 'LIS']

function generateTxnId() {
  return 'ABHA-TXN-' + Math.floor(Math.random() * 900000 + 100000)
}

function generateConsentId() {
  return 'CONS-' + Date.now().toString().slice(-8)
}

function maskPhone(phone = '+919876543210') {
  return 'XXXXXX' + String(phone).slice(-4)
}

export function simulateAbhaOtp(abhaId) {
  return {
    message: 'OTP sent successfully to registered Aadhaar mobile number',
    txnId: generateTxnId(),
    maskedPhone: maskPhone()
  }
}

export function confirmAbhaOtp(abhaId, otp, txnId) {
  if (!abhaId || !otp || !txnId) {
    throw new Error('ABHA ID, OTP, and transaction ID are required')
  }
  if (otp !== '123456') {
    const err = new Error('Invalid OTP. Please enter 123456 for simulator validation.')
    err.status = 400
    throw err
  }
  return {
    verified: true,
    abhaDetails: {
      abhaNumber: '12-3456-7890-1234',
      abhaAddress: abhaId.includes('@') ? abhaId : `${abhaId}@sbx`,
      name: 'Karan Sharma',
      gender: 'M',
      dob: '1990-08-15',
      phone: '+919876543210',
      address: 'Sector 62, Noida, Uttar Pradesh'
    }
  }
}

export async function listAbdmConsents(db, user, tenant) {
  const query = {}
  if (user?.role === 'patient') {
    const patient = await db(Patient).findOne({ email: user.email })
    if (!patient) return []
    query.patient = patient._id
  }
  return db(AbdmConsent).find(query).sort({ createdAt: -1 })
}

export async function createAbdmConsent(db, tenantId, userId, payload) {
  const { patientId, purpose, dataTypes, expiry } = payload
  const patient = await db(Patient).findById(patientId)
  if (!patient) {
    const err = new Error('Patient not found')
    err.status = 404
    throw err
  }

  const consent = await db(AbdmConsent).create({
    tenantId,
    consentId: generateConsentId(),
    patient: patientId,
    patientName: `${patient.firstName} ${patient.lastName}`,
    purpose: purpose || 'Clinical Consult',
    dataTypes: Array.isArray(dataTypes) && dataTypes.length ? dataTypes : DEFAULT_DATA_TYPES,
    expiry: expiry ? new Date(expiry) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    status: 'requested',
    createdBy: userId
  })

  return consent
}

export async function updateAbdmConsentStatus(db, consentId, status) {
  const consent = await db(AbdmConsent).findById(consentId)
  if (!consent) {
    const err = new Error('Consent log not found')
    err.status = 404
    throw err
  }
  consent.status = status
  if (status === 'granted') {
    consent.grantedAt = new Date()
  }
  return consent.save()
}

export async function syncAbdmHealthRecord(db, patientId, recordType, recordId) {
  const patient = await db(Patient).findById(patientId)
  if (!patient) {
    const err = new Error('Patient not found')
    err.status = 404
    throw err
  }
  const bundleId = 'FHIR-BND-' + Date.now().toString().slice(-6) + Math.floor(Math.random() * 100)
  return {
    success: true,
    message: 'Health record successfully compiled into FHIR bundle and synced with NDHM Health Information Provider (HIP) gateway.',
    bundleId,
    timestamp: new Date()
  }
}