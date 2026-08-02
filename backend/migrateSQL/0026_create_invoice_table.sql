-- Migration: 0026
-- Table: invoice
-- Depends on: tenant, patient, plan
-- NOTE: invoice_number is unique per tenant, not globally unique (multi-tenant
-- fix flagged during review -- a bare NOT NULL gave no real uniqueness guarantee).
-- plan_id is nullable: set only for subscription/hospital-billing invoices,
-- null for normal patient invoices. Same table intentionally serves both cases.

CREATE TABLE invoice (
    invoice_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number  INT NOT NULL,
    patient_id      UUID NOT NULL,
    tenant_id       UUID NOT NULL,
    plan_id         UUID,
    subtotal        NUMERIC(10,2) NOT NULL,
    gst_total       NUMERIC(10,2) NOT NULL,
    total           NUMERIC(10,2) NOT NULL,
    status          VARCHAR(50) NOT NULL DEFAULT 'pending',
    paid            BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at      TIMESTAMP NULL,
    CONSTRAINT uq_invoice_tenant_number UNIQUE (tenant_id, invoice_number),
    CONSTRAINT fk_invoice_patient FOREIGN KEY (patient_id) REFERENCES patient(patient_id) ON DELETE RESTRICT,
    CONSTRAINT fk_invoice_tenant  FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id) ON DELETE CASCADE,
    CONSTRAINT fk_invoice_plan    FOREIGN KEY (plan_id) REFERENCES plan(plan_id) ON DELETE SET NULL,
    CONSTRAINT chk_invoice_amounts CHECK (subtotal >= 0 AND gst_total >= 0 AND total >= 0),
    CONSTRAINT chk_invoice_status CHECK (status IN ('draft', 'pending', 'paid', 'cancelled', 'refunded'))
);

CREATE INDEX idx_invoice_tenant ON invoice(tenant_id);
CREATE INDEX idx_invoice_patient ON invoice(patient_id);
CREATE INDEX idx_invoice_tenant_status ON invoice(tenant_id, status);
CREATE INDEX idx_invoice_tenant_created ON invoice(tenant_id, created_at);
