-- Migration: 0027
-- Table: invoice_item
-- Depends on: invoice, medicine, tenant
-- NOTE: medicine_id is nullable -- not every invoice line item is a medicine
-- (room charges, consultation fees, and lab/radiology charges also appear as
-- invoice items with no medicine reference). item_name_snapshot/
-- unit_price_snapshot/gst_rate_snapshot are set once at creation and must
-- never be updated afterwards, even if the source medicine's price changes.

CREATE TABLE invoice_item (
    invoice_item_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id           UUID NOT NULL,
    medicine_id          UUID,
    tenant_id            UUID NOT NULL,
    item_name_snapshot   VARCHAR(255) NOT NULL,
    quantity             INT NOT NULL,
    unit_price_snapshot  NUMERIC(10,2) NOT NULL,
    gst_rate_snapshot    NUMERIC(5,2) NOT NULL DEFAULT 0,
    created_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at           TIMESTAMP NULL,
    CONSTRAINT fk_invoice_item_invoice  FOREIGN KEY (invoice_id) REFERENCES invoice(invoice_id) ON DELETE CASCADE,
    CONSTRAINT fk_invoice_item_medicine FOREIGN KEY (medicine_id) REFERENCES medicine(medicine_id) ON DELETE SET NULL,
    CONSTRAINT fk_invoice_item_tenant   FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id) ON DELETE CASCADE,
    CONSTRAINT chk_invoice_item_qty CHECK (quantity > 0),
    CONSTRAINT chk_invoice_item_price CHECK (unit_price_snapshot >= 0)
);

CREATE INDEX idx_invoice_item_tenant ON invoice_item(tenant_id);
CREATE INDEX idx_invoice_item_invoice ON invoice_item(invoice_id);
CREATE INDEX idx_invoice_item_medicine ON invoice_item(medicine_id);
