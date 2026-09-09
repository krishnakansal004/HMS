-- Migration: 0040
-- Tables: payment, stock_movement
-- Depends on: tenant, invoice, medicine
--
-- payment: individual payment records against an invoice. invoice.paid
-- (boolean) alone can't represent partial payments, so this table tracks
-- each payment, and invoice.amount_paid (added below) tracks the running
-- total so status can move draft -> pending -> partial -> paid.
--
-- stock_movement: audit trail for every medicine stock change (purchase,
-- dispense, return, adjustment, expiry write-off). quantity is signed:
-- positive for stock in, negative for stock out.

ALTER TABLE invoice
    ADD COLUMN amount_paid NUMERIC(10,2) NOT NULL DEFAULT 0;

-- Widen the status check to include 'partial' alongside the existing values.
ALTER TABLE invoice DROP CONSTRAINT IF EXISTS chk_invoice_status;
ALTER TABLE invoice
    ADD CONSTRAINT chk_invoice_status
    CHECK (status IN ('draft', 'pending', 'partial', 'paid', 'cancelled', 'refunded'));

CREATE TABLE payment (
    payment_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id      UUID NOT NULL REFERENCES invoice(invoice_id) ON DELETE CASCADE,
    tenant_id       UUID NOT NULL REFERENCES tenant(tenant_id) ON DELETE CASCADE,
    amount          NUMERIC(10,2) NOT NULL CHECK (amount > 0),
    method          VARCHAR(50) NOT NULL,
    transaction_id  VARCHAR(255),
    status          VARCHAR(50) NOT NULL DEFAULT 'success'
                    CHECK (status IN ('success', 'failed', 'refunded')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_payment_invoice ON payment(invoice_id);
CREATE INDEX idx_payment_tenant ON payment(tenant_id);
CREATE INDEX idx_payment_tenant_active ON payment(tenant_id) WHERE deleted_at IS NULL;

CREATE TABLE stock_movement (
    stock_movement_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    medicine_id         UUID NOT NULL REFERENCES medicine(medicine_id) ON DELETE CASCADE,
    tenant_id           UUID NOT NULL REFERENCES tenant(tenant_id) ON DELETE CASCADE,
    type                VARCHAR(50) NOT NULL
                        CHECK (type IN ('PURCHASE', 'DISPENSE', 'RETURN', 'ADJUSTMENT', 'EXPIRED')),
    quantity            INT NOT NULL,
    reference_id        UUID,
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_stock_movement_medicine ON stock_movement(medicine_id);
CREATE INDEX idx_stock_movement_tenant ON stock_movement(tenant_id);

-- Row Level Security, same pattern as 0035.
ALTER TABLE payment ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_payment ON payment
    USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

ALTER TABLE stock_movement ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movement FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_stock_movement ON stock_movement
    USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- updated_at trigger for payment, matching 0039's convention for other tables.
CREATE TRIGGER trg_payment_updated_at
    BEFORE UPDATE ON payment
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();