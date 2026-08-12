-- Migration: 0012
-- Table: patient
-- Purpose: Patient records.
-- Depends on: tenant, users, bed
-- NOTE: user_id is nullable on purpose -- a patient can be registered by
-- front-desk staff without ever having a portal login account.

CREATE TABLE patient (
    patient_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id      UUID NOT NULL,
    user_id        UUID,
    first_name     VARCHAR(100) NOT NULL,
    last_name      VARCHAR(100),
    gender         VARCHAR(20),
    date_of_birth  DATE,
    blood_group    VARCHAR(10),
    phone          VARCHAR(20),
    email          VARCHAR(255),
    address        TEXT,
    bed_id         UUID,
    is_admitted    BOOLEAN NOT NULL DEFAULT FALSE,
    admitted_at    TIMESTAMP,
    created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at     TIMESTAMP NULL,
    CONSTRAINT fk_patient_user   FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL,
    CONSTRAINT fk_patient_tenant FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id) ON DELETE CASCADE,
    CONSTRAINT fk_patient_bed    FOREIGN KEY (bed_id) REFERENCES bed(bed_id) ON DELETE SET NULL

    CONSTRAINT uk_tenant_phone UNIQUE (tenant_id, phone),
    CONSTRAINT uk_tenant_email UNIQUE (tenant_id, email)
);

CREATE INDEX idx_patient_tenant ON patient(tenant_id);
CREATE INDEX idx_patient_bed ON patient(bed_id);
CREATE INDEX idx_patient_user ON patient(user_id);
