-- Migration: 0034
-- Table: radiology_order
-- Depends on: tenant, patient, doctor_profile

CREATE TABLE radiology_order (
    radiology_order_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL,
    patient_id              UUID NOT NULL,
    patient_name_snapshot   VARCHAR(255) NOT NULL,
    doctor_id               UUID,
    modality                VARCHAR(100) NOT NULL,
    study_type              VARCHAR(255) NOT NULL,
    body_part               VARCHAR(100),
    urgency                 VARCHAR(50) NOT NULL DEFAULT 'routine',
    price                   NUMERIC(10,2) NOT NULL DEFAULT 0,
    notes                   TEXT,
    findings                TEXT,
    impression              TEXT,
    scan_metadata           JSONB,
    status                  VARCHAR(50) NOT NULL DEFAULT 'ordered',
    billing_status          VARCHAR(50) NOT NULL DEFAULT 'unbilled',
    created_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at              TIMESTAMP NULL,
    CONSTRAINT fk_radiology_order_tenant  FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id) ON DELETE CASCADE,
    CONSTRAINT fk_radiology_order_patient FOREIGN KEY (patient_id) REFERENCES patient(patient_id) ON DELETE RESTRICT,
    CONSTRAINT fk_radiology_order_doctor  FOREIGN KEY (doctor_id) REFERENCES doctor_profile(doctor_profile_id) ON DELETE SET NULL,
    CONSTRAINT chk_radiology_order_price CHECK (price >= 0),
    CONSTRAINT chk_radiology_order_urgency CHECK (urgency IN ('routine', 'urgent', 'stat')),
    CONSTRAINT chk_radiology_order_status CHECK (status IN ('ordered', 'scheduled', 'in_progress', 'completed', 'cancelled')),
    CONSTRAINT chk_radiology_order_billing_status CHECK (billing_status IN ('unbilled', 'billed', 'paid'))
);

CREATE INDEX idx_radiology_order_tenant ON radiology_order(tenant_id);
CREATE INDEX idx_radiology_order_patient ON radiology_order(patient_id);
CREATE INDEX idx_radiology_order_tenant_status ON radiology_order(tenant_id, status);
