-- Migration: 0030
-- Table: payment_request
-- Depends on: tenant, patient, prescription
-- NOTE: renamed from "payment" to "payment_request" -- the fields
-- (razorpay_link_id + status) describe a payment LINK sent to the patient,
-- not a settled transaction record. This naming avoids confusion with an
-- actual completed-payment ledger if one gets added later.

CREATE TABLE payment_request (
    payment_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id        UUID NOT NULL,
    tenant_id         UUID NOT NULL,
    prescription_id   UUID,
    total             NUMERIC(10,2) NOT NULL,
    razorpay_link_id  VARCHAR(255),
    status            VARCHAR(50) NOT NULL DEFAULT 'pending',
    created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at        TIMESTAMP NULL,
    CONSTRAINT fk_payment_request_patient      FOREIGN KEY (patient_id) REFERENCES patient(patient_id) ON DELETE RESTRICT,
    CONSTRAINT fk_payment_request_tenant       FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id) ON DELETE CASCADE,
    CONSTRAINT fk_payment_request_prescription FOREIGN KEY (prescription_id) REFERENCES prescription(prescription_id) ON DELETE SET NULL,
    CONSTRAINT chk_payment_request_total CHECK (total >= 0),
    CONSTRAINT chk_payment_request_status CHECK (status IN ('pending', 'paid', 'failed', 'cancelled', 'expired'))
);

CREATE INDEX idx_payment_request_tenant ON payment_request(tenant_id);
CREATE INDEX idx_payment_request_patient ON payment_request(patient_id);
