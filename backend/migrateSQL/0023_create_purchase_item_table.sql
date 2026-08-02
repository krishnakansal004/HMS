-- Migration: 0023
-- Table: purchase_item
-- Depends on: purchase, medicine, tenant

CREATE TABLE purchase_item (
    purchase_item_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_id         UUID NOT NULL,
    medicine_id         UUID NOT NULL,
    tenant_id           UUID NOT NULL,
    quantity            INT NOT NULL,
    unit_cost_snapshot  NUMERIC(10,2) NOT NULL,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at          TIMESTAMP NULL,
    CONSTRAINT fk_purchase_item_purchase FOREIGN KEY (purchase_id) REFERENCES purchase(purchase_id) ON DELETE CASCADE,
    CONSTRAINT fk_purchase_item_medicine FOREIGN KEY (medicine_id) REFERENCES medicine(medicine_id) ON DELETE RESTRICT,
    CONSTRAINT fk_purchase_item_tenant   FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id) ON DELETE CASCADE,
    CONSTRAINT chk_purchase_item_qty CHECK (quantity > 0),
    CONSTRAINT chk_purchase_item_cost CHECK (unit_cost_snapshot >= 0)
);

CREATE INDEX idx_purchase_item_tenant ON purchase_item(tenant_id);
CREATE INDEX idx_purchase_item_purchase ON purchase_item(purchase_id);
CREATE INDEX idx_purchase_item_medicine ON purchase_item(medicine_id);
