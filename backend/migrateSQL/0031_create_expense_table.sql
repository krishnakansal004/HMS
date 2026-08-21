-- Migration: 0031
-- Table: expense
-- Depends on: tenant, users
-- the actual table is named "users". Kept consistent across the whole schema.

CREATE TABLE expense (
    expense_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     UUID NOT NULL,
    title         VARCHAR(255) NOT NULL,
    category      VARCHAR(100) NOT NULL,
    amount        NUMERIC(10,2) NOT NULL,
    expense_date  DATE NOT NULL,
    created_by    UUID NOT NULL,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at    TIMESTAMP NULL,
    CONSTRAINT fk_expense_tenant     FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id) ON DELETE CASCADE,
    CONSTRAINT fk_expense_created_by FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE RESTRICT,
    CONSTRAINT chk_expense_amount CHECK (amount >= 0)
);

CREATE INDEX idx_expense_tenant ON expense(tenant_id);
CREATE INDEX idx_expense_tenant_date ON expense(tenant_id, expense_date);
