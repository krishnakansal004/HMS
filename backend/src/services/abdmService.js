import { db } from "../config/db.js";

const DEFAULT_DATA_TYPES = ["OPD", "Prescription", "LIS"];

function generateTxnId() {
  return "ABHA-TXN-" + Math.floor(Math.random() * 900000 + 100000);
}

function generateConsentId() {
  return "CONS-" + Date.now().toString().slice(-8);
}

function maskPhone(phone = "+919876543210") {
  return "XXXXXX" + String(phone).slice(-4);
}

export function simulateAbhaOtp(abhaId) {
  return {
    message: "OTP sent successfully to registered Aadhaar mobile number",
    txnId: generateTxnId(),
    maskedPhone: maskPhone(),
  };
}

export function confirmAbhaOtp(abhaId, otp, txnId) {
  if (!abhaId || !otp || !txnId) throw new Error("ABHA ID, OTP, and transaction ID are required");
  if (otp !== "123456") {
    const err = new Error("Invalid OTP. Please enter 123456 for simulator validation.");
    err.status = 400;
    throw err;
  }
  return {
    verified: true,
    abhaDetails: {
      abhaNumber: "12-3456-7890-1234",
      abhaAddress: abhaId.includes("@") ? abhaId : `${abhaId}@sbx`,
      name: "Karan Sharma",
      gender: "M",
      dob: "1990-08-15",
      phone: "+919876543210",
      address: "Sector 62, Noida, Uttar Pradesh",
    },
  };
}

export async function listAbdmConsents(dbClient, user, tenant) {
  const where = { tenant_id: tenant?.tenant_id || user?.tenantId };
  if (user?.role === "PATIENT") {
    const patient = await db.patient.findFirst({ where: { user_id: user.id } });
    if (!patient) return [];
    where.patient_id = patient.patient_id;
  }
  return db.abdm_consent.findMany({ where, orderBy: { created_at: 'desc' } });
}

export async function createAbdmConsent(dbClient, tenantId, userId, payload) {
  const { patientId, purpose, dataTypes, expiry } = payload;
  const patient = await db.patient.findUnique({ where: { patient_id: patientId } });
  
  if (!patient) {
    const err = new Error("Patient not found");
    err.status = 404;
    throw err;
  }

  return db.abdm_consent.create({
    data: {
      tenant_id: tenantId,
      consent_ref: generateConsentId(),
      patient_id: patientId,
      purpose: purpose || "Clinical Consult",
      data_types: Array.isArray(dataTypes) && dataTypes.length ? dataTypes : DEFAULT_DATA_TYPES,
      expiry: expiry ? new Date(expiry) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      status: "REQUESTED",
      created_by: userId,
    }
  });
}

export async function updateAbdmConsentStatus(dbClient, consentId, status) {
  const consent = await db.abdm_consent.findUnique({ where: { consent_id: consentId } });
  if (!consent) {
    const err = new Error("Consent log not found");
    err.status = 404;
    throw err;
  }
  return db.abdm_consent.update({
    where: { consent_id: consentId },
    data: {
      status,
      granted_at: status === "GRANTED" ? new Date() : undefined,
      updated_at: new Date()
    }
  });
}

export async function syncAbdmHealthRecord(dbClient, patientId, recordType, recordId) {
  const patient = await db.patient.findUnique({ where: { patient_id: patientId } });
  if (!patient) {
    const err = new Error("Patient not found");
    err.status = 404;
    throw err;
  }
  const bundleId = "FHIR-BND-" + Date.now().toString().slice(-6) + Math.floor(Math.random() * 100);
  return {
    success: true,
    message: "Health record successfully compiled into FHIR bundle and synced with NDHM Health Information Provider (HIP) gateway.",
    bundleId,
    timestamp: new Date(),
  };
}