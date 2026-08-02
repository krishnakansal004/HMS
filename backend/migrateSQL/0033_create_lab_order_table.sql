-- Migration: 0033
-- Table: lab_order
-- Purpose: An actual ordered test for a patient (with results), distinct from
-- the lab_test catalog.
-- Depends on: tenant, patient, lab_test, doctor_profile, prescription
-- NOTE: this table did not exist in the earlier draft -- lab_test (the
-- catalog) was created, but there was no table linking a patient/doctor to an
-- actually-ordered test with results, which every other diagnostic flow
-- (radiology_order) already has. Added here to complete the design.

CREATE TABLE lab_order (
    lab_order_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL,
    patient_id              UUID NOT NULL,
    patient_name_snapshot   VARCHAR(255) NOT NULL,
    test_id                 UUID NOT NULL,
    test_name_snapshot      VARCHAR(255) NOT NULL,
    test_code_snapshot      VARCHAR(100),
    doctor_id               UUID,
    doctor_name_snapshot    VARCHAR(255),
    prescription_id         UUID,
    sample_status           VARCHAR(50) NOT NULL DEFAULT 'pending',
    technician_notes        TEXT,
    results                 JSONB,
    created_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at              TIMESTAMP NULL,
    CONSTRAINT fk_lab_order_tenant       FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id) ON DELETE CASCADE,
    CONSTRAINT fk_lab_order_patient      FOREIGN KEY (patient_id) REFERENCES patient(patient_id) ON DELETE RESTRICT,
    CONSTRAINT fk_lab_order_test         FOREIGN KEY (test_id) REFERENCES lab_test(test_id) ON DELETE RESTRICT,
    CONSTRAINT fk_lab_order_doctor       FOREIGN KEY (doctor_id) REFERENCES doctor_profile(doctor_profile_id) ON DELETE SET NULL,
    CONSTRAINT fk_lab_order_prescription FOREIGN KEY (prescription_id) REFERENCES prescription(prescription_id) ON DELETE SET NULL,
    CONSTRAINT chk_lab_order_sample_status CHECK (sample_status IN ('pending', 'collected', 'in_lab', 'completed', 'cancelled'))
);

CREATE INDEX idx_lab_order_tenant ON lab_order(tenant_id);
CREATE INDEX idx_lab_order_patient ON lab_order(patient_id);
CREATE INDEX idx_lab_order_test ON lab_order(test_id);
CREATE INDEX idx_lab_order_tenant_status ON lab_order(tenant_id, sample_status);
