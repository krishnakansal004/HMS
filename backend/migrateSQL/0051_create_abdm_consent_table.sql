-- Migration: 0051
-- Tables: abdm_consent (new)
-- Phase: 7 — Compliance & Integration (Ayushman Bharat Digital Mission)
--
-- services/abdmService.js exists but is still 100% pre-Prisma (imports
-- models/Patient.js and models/AbdmConsent.js directly, takes a `db`
-- callback-style parameter that doesn't match the current db.js export at
-- all). Unlike hrms/emergency/faq, there's no Prisma-era field-name
-- precedent to match here -- this design is derived from the legacy
-- AbdmConsent usage in abdmService.js's own createAbdmConsent/
-- updateAbdmConsentStatus/listAbdmConsents functions.
--
-- The ABHA identity-verification part of this module (simulateAbhaOtp,
-- confirmAbhaOtp) is a stateless mock/simulator with no DB reads or writes
-- at all -- nothing to migrate there, that logic can be ported as-is.
--
-- Depends on: tenant (0004), patient (existing), users (0005)

CREATE TABLE abdm_consent (
    consent_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id         UUID NOT NULL,
    patient_id        UUID NOT NULL,
    consent_ref        VARCHAR(50) NOT NULL,
    purpose           VARCHAR(255) DEFAULT 'Clinical Consult',
    data_types         JSONB DEFAULT '["OPD", "Prescription", "LIS"]',
    status            VARCHAR(20) NOT NULL DEFAULT 'REQUESTED',
    expiry            TIMESTAMPTZ,
    granted_at         TIMESTAMPTZ,
    created_by         UUID,
    created_at         TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at         TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_abdm_consent_tenant FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id) ON DELETE CASCADE,
    CONSTRAINT fk_abdm_consent_patient FOREIGN KEY (patient_id) REFERENCES patient(patient_id) ON DELETE CASCADE,
    CONSTRAINT fk_abdm_consent_creator FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL,
    CONSTRAINT chk_abdm_consent_status CHECK (status IN ('REQUESTED', 'GRANTED', 'DENIED', 'REVOKED')),
    CONSTRAINT uq_abdm_consent_ref UNIQUE (consent_ref)
);

CREATE INDEX idx_abdm_consent_tenant ON abdm_consent(tenant_id);
CREATE INDEX idx_abdm_consent_patient ON abdm_consent(patient_id);

ALTER TABLE abdm_consent ENABLE ROW LEVEL SECURITY;
ALTER TABLE abdm_consent FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_abdm_consent ON abdm_consent
  USING (tenant_id = (current_setting('app.current_tenant_id', true))::uuid);

CREATE TRIGGER trg_abdm_consent_updated_at BEFORE UPDATE ON abdm_consent
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
