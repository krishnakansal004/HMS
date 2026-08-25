import {
  simulateAbhaOtp,
  confirmAbhaOtp,
  listAbdmConsents,
  createAbdmConsent,
  updateAbdmConsentStatus,
  syncAbdmHealthRecord,
} from "../services/abdmService.js";
import { logActivity } from "../utils/auditHelper.js";

function handleError(res, error, defaultMessage) {
  const status = error.status || 500;
  const message = error.message || defaultMessage;
  return res.status(status).json({ error: message });
}

export async function verifyAbhaOtp(req, res) {
  try {
    const { abhaId } = req.body;
    if (!abhaId)
      return res.status(400).json({ error: "ABHA ID or Address is required" });
    const result = simulateAbhaOtp(abhaId);
    res.json(result);
  } catch (error) {
    handleError(res, error, "ABHA verification service unavailable");
  }
}

export async function confirmAbhaOtpHandler(req, res) {
  try {
    const { abhaId, otp, txnId } = req.body;
    const result = confirmAbhaOtp(abhaId, otp, txnId);
    res.json(result);
  } catch (error) {
    handleError(res, error, "ABHA confirmation service timeout");
  }
}

export async function getConsents(req, res) {
  try {
    const consents = await listAbdmConsents(req.db, req.user, req.tenant);
    res.json(consents);
  } catch (error) {
    handleError(res, error, "Failed to load consent logs");
  }
}

export async function createConsent(req, res) {
  try {
    const tenantId = req.tenant?._id || req.user?.tenantId;
    const consent = await createAbdmConsent(
      req.db,
      tenantId,
      req.userId,
      req.body,
    );
    await logActivity(req, "REQUEST_ABDM_CONSENT", "abdmconsent", consent._id, {
      patientId: req.body.patientId,
      consentId: consent.consentId,
    });
    res.status(201).json(consent);
  } catch (error) {
    handleError(res, error, "Failed to create consent request");
  }
}

export async function updateConsentStatus(req, res) {
  try {
    const { status } = req.body;
    const updated = await updateAbdmConsentStatus(
      req.db,
      req.params.id,
      status,
    );
    await logActivity(
      req,
      "UPDATE_ABDM_CONSENT_STATUS",
      "abdmconsent",
      updated._id,
      { status },
    );
    res.json(updated);
  } catch (error) {
    handleError(res, error, "Failed to update consent status");
  }
}

export async function syncRecords(req, res) {
  try {
    const { patientId, recordType, recordId } = req.body;
    const result = await syncAbdmHealthRecord(
      req.db,
      patientId,
      recordType,
      recordId,
    );
    await logActivity(req, "SYNC_ABDM_HEALTH_RECORD", "abdmrecord", recordId, {
      patientId,
      recordType,
      bundleId: result.bundleId,
    });
    res.json(result);
  } catch (error) {
    handleError(res, error, "Failed to sync health records");
  }
}
