-- Migration: 0029
-- Table: plan_receipt
-- Purpose: Point-in-time receipt generated after a subscription invoice is paid.
-- Depends on: invoice, plan, tenant

CREATE TABLE plan_receipt (
    receipt_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id  UUID NOT NULL,
    plan_id     UUID NOT NULL,
    tenant_id   UUID NOT NULL,
    total       NUMERIC(10,2) NOT NULL,
    paid_at     TIMESTAMP,
    pdf_url     TEXT,
    pdf_path    TEXT,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_plan_receipt_invoice FOREIGN KEY (invoice_id) REFERENCES invoice(invoice_id) ON DELETE RESTRICT,
    CONSTRAINT fk_plan_receipt_plan    FOREIGN KEY (plan_id) REFERENCES plan(plan_id) ON DELETE RESTRICT,
    CONSTRAINT fk_plan_receipt_tenant  FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id) ON DELETE CASCADE,
    CONSTRAINT chk_plan_receipt_total CHECK (total >= 0)
);

CREATE INDEX idx_plan_receipt_tenant ON plan_receipt(tenant_id);
CREATE INDEX idx_plan_receipt_invoice ON plan_receipt(invoice_id);
