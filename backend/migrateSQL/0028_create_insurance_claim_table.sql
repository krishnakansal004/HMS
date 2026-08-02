-- Migration: 0028
-- Table: insurance_claim
-- Depends on: patient, insurance_company, invoice, tenant
-- NOTE: tenant_id added (was missing in the earlier draft -- every other
-- billing table has it; needed for RLS without a join back through invoice).
-- invoice_id is nullable: not every claim ties back to a single invoice.

CREATE TABLE insurance_claim (
    claim_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id         UUID NOT NULL,
    company_id         UUID NOT NULL,
    invoice_id         UUID,
    tenant_id          UUID NOT NULL,
    policy_number      VARCHAR(100) NOT NULL,
    total_bill_amount  NUMERIC(10,2) NOT NULL,
    claimed_amount     NUMERIC(10,2) NOT NULL,
    approved_amount    NUMERIC(10,2),
    rejection_reason   TEXT,
    settlement_date    DATE,
    status             VARCHAR(50) NOT NULL DEFAULT 'submitted',
    created_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at         TIMESTAMP NULL,
    CONSTRAINT fk_insurance_claim_patient FOREIGN KEY (patient_id) REFERENCES patient(patient_id) ON DELETE RESTRICT,
    CONSTRAINT fk_insurance_claim_company FOREIGN KEY (company_id) REFERENCES insurance_company(company_id) ON DELETE RESTRICT,
    CONSTRAINT fk_insurance_claim_invoice FOREIGN KEY (invoice_id) REFERENCES invoice(invoice_id) ON DELETE SET NULL,
    CONSTRAINT fk_insurance_claim_tenant  FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id) ON DELETE CASCADE,
    CONSTRAINT chk_insurance_claim_amounts CHECK (total_bill_amount >= 0 AND claimed_amount >= 0),
    CONSTRAINT chk_insurance_claim_status CHECK (status IN ('submitted', 'under_review', 'approved', 'rejected', 'settled'))
);

CREATE INDEX idx_insurance_claim_tenant ON insurance_claim(tenant_id);
CREATE INDEX idx_insurance_claim_patient ON insurance_claim(patient_id);
CREATE INDEX idx_insurance_claim_company ON insurance_claim(company_id);
