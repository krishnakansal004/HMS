-- Migration: 0021
-- Table: medicine
-- Depends on: tenant, supplier
-- NOTE: supplier_id is nullable (changed from NOT NULL in the earlier draft)
-- since it represents a preferred/default supplier, not a hard requirement --
-- actual sourcing per restock is tracked in purchase_item. Confirm this
-- interpretation with the team before merging.

CREATE TABLE medicine (
    medicine_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL,
    supplier_id     UUID,
    name            VARCHAR(255) NOT NULL,
    batch_number    VARCHAR(100) NOT NULL,
    expiry_date     DATE NOT NULL,
    quantity        INT NOT NULL DEFAULT 0,
    reorder_level   INT NOT NULL DEFAULT 0,
    gst_rate        NUMERIC(5,2) NOT NULL DEFAULT 0,
    purchase_price  NUMERIC(10,2) NOT NULL DEFAULT 0,
    selling_price   NUMERIC(10,2) NOT NULL DEFAULT 0,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at      TIMESTAMP NULL,
    CONSTRAINT fk_medicine_tenant   FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id) ON DELETE CASCADE,
    CONSTRAINT fk_medicine_supplier FOREIGN KEY (supplier_id) REFERENCES supplier(supplier_id) ON DELETE SET NULL,
    CONSTRAINT chk_medicine_quantity CHECK (quantity >= 0),
    CONSTRAINT chk_medicine_reorder CHECK (reorder_level >= 0),
    CONSTRAINT chk_medicine_prices CHECK (purchase_price >= 0 AND selling_price >= 0)
);

CREATE INDEX idx_medicine_tenant ON medicine(tenant_id);
CREATE INDEX idx_medicine_supplier ON medicine(supplier_id);
