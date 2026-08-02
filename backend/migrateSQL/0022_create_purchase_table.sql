-- Migration: 0022
-- Table: purchase
-- Depends on: tenant, supplier

CREATE TABLE purchase (
    purchase_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id    UUID NOT NULL,
    supplier_id  UUID NOT NULL,
    order_id     VARCHAR(100),
    order_date   DATE NOT NULL DEFAULT CURRENT_DATE,
    total_cost   NUMERIC(10,2) NOT NULL DEFAULT 0,
    status       VARCHAR(50) NOT NULL DEFAULT 'pending',
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at   TIMESTAMP NULL,
    CONSTRAINT fk_purchase_tenant   FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id) ON DELETE CASCADE,
    CONSTRAINT fk_purchase_supplier FOREIGN KEY (supplier_id) REFERENCES supplier(supplier_id) ON DELETE RESTRICT,
    CONSTRAINT chk_purchase_total CHECK (total_cost >= 0),
    CONSTRAINT chk_purchase_status CHECK (status IN ('pending', 'ordered', 'received', 'cancelled'))
);

CREATE INDEX idx_purchase_tenant ON purchase(tenant_id);
CREATE INDEX idx_purchase_supplier ON purchase(supplier_id);
