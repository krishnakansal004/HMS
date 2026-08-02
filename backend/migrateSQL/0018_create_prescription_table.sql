-- Migration: 0018
-- Table: prescription
-- Purpose: Prescriptions written by a doctor for a patient.
-- Depends on: tenant, doctor_profile, patient
-- NOTE: fixes typo from the earlier draft ("approval_statues" -> "approval_status").
-- medicines/tests stay embedded JSONB (matches current app behavior; there is
-- no reporting requirement on individual prescribed medicines today, unlike
-- invoice/purchase items). Revisit if per-medicine prescription reporting is
-- ever needed -- normalize into a prescription_item table at that point.

CREATE TABLE prescription (
    prescription_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id              UUID NOT NULL,
    doctor_id              UUID NOT NULL,
    patient_id             UUID NOT NULL,
    patient_name_snapshot  VARCHAR(255) NOT NULL,
    medicines              JSONB NOT NULL DEFAULT '[]',
    tests                  JSONB NOT NULL DEFAULT '[]',
    approval_status        VARCHAR(50) NOT NULL DEFAULT 'pending',
    notes                  TEXT,
    created_at             TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at             TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at             TIMESTAMP NULL,
    CONSTRAINT fk_prescription_tenant  FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id) ON DELETE CASCADE,
    CONSTRAINT fk_prescription_patient FOREIGN KEY (patient_id) REFERENCES patient(patient_id) ON DELETE CASCADE,
    CONSTRAINT fk_prescription_doctor  FOREIGN KEY (doctor_id) REFERENCES doctor_profile(doctor_profile_id) ON DELETE CASCADE,
    CONSTRAINT chk_prescription_approval CHECK (approval_status IN ('pending', 'approved', 'rejected'))
);

CREATE INDEX idx_prescription_tenant ON prescription(tenant_id);
CREATE INDEX idx_prescription_patient ON prescription(patient_id);
CREATE INDEX idx_prescription_doctor ON prescription(doctor_id);
