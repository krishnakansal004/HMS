-- Create Invoice Item Table

CREATE TABLE invoice_item (
    invoice_item_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL,
    medicine_id UUID NOT NULL,
    tenant_id UUID NOT NULL,

    item_name_snapshot VARCHAR(255) NOT NULL,
    quantity INT NOT NULL,
    unit_price_snapshot NUMERIC(10,2) NOT NULL,
    gst_rate_snapshot NUMERIC(5,2) NOT NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,

    CONSTRAINT fk_invoice_item_invoice
        FOREIGN KEY (invoice_id)
        REFERENCES invoice (invoice_id),

    CONSTRAINT fk_invoice_item_medicine
        FOREIGN KEY (medicine_id)
        REFERENCES medicine (medicine_id),

    CONSTRAINT fk_invoice_item_tenant
        FOREIGN KEY (tenant_id)
        REFERENCES tenant (tenant_id)
);