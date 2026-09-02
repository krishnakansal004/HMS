import {
  simulateAbhaOtp,
  confirmAbhaOtp,
  listAbdmConsents,
  createAbdmConsent,
  updateAbdmConsentStatus,
  syncAbdmHealthRecord,
} from "../services/abdmService.js";
import { AuditService } from "../services/auditService.js";

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
    const consents = await listAbdmConsents(null, req.user, req.tenant);
    res.json(consents);
  } catch (error) {
    handleError(res, error, "Failed to load consent logs");
  }
}

export async function createConsent(req, res) {
  try {
    const tenantId = req.currentTenantId || req.user?.tenant_id;
    const consent = await createAbdmConsent(
      null,
      tenantId,
      req.userId,
      req.body,
    );
    AuditService.logAction({
      tenantId,
      userId: req.userId,
      action: "REQUEST_ABDM_CONSENT",
      entityType: "ABDM_CONSENT",
      entityId: consent.consent_id,
      newValue: { patientId: req.body.patientId, consentRef: consent.consent_ref },
      ipAddress: req.ip,
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
      null,
      req.params.id,
      status,
    );
    AuditService.logAction({
      tenantId: req.currentTenantId || req.user?.tenant_id,
      userId: req.userId,
      action: "UPDATE_ABDM_CONSENT_STATUS",
      entityType: "ABDM_CONSENT",
      entityId: updated.consent_id,
      newValue: { status },
      ipAddress: req.ip,
    });
    res.json(updated);
  } catch (error) {
    handleError(res, error, "Failed to update consent status");
  }
}

export async function syncRecords(req, res) {
  try {
    const { patientId, recordType, recordId } = req.body;
    const result = await syncAbdmHealthRecord(
      null,
      patientId,
      recordType,
      recordId,
    );
    AuditService.logAction({
      tenantId: req.currentTenantId || req.user?.tenant_id,
      userId: req.userId,
      action: "SYNC_ABDM_HEALTH_RECORD",
      entityType: "ABDM_RECORD",
      entityId: recordId,
      newValue: { patientId, recordType, bundleId: result.bundleId },
      ipAddress: req.ip,
    });
    res.json(result);
  } catch (error) {
    handleError(res, error, "Failed to sync health records");
  }
}