-- Create Medicine Table

CREATE TABLE medicine (
    medicine_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    supplier_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    batch_number VARCHAR(100) NOT NULL,
    expiry_date DATE NOT NULL,
    quantity INT NOT NULL,
    reorder_level INT NOT NULL,
    gst_rate NUMERIC(5,2) NOT NULL,
    purchase_price NUMERIC(10,2) NOT NULL,
    selling_price NUMERIC(10,2) NOT NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,

    CONSTRAINT fk_medicine_tenant
        FOREIGN KEY (tenant_id)
        REFERENCES tenant (tenant_id),

    CONSTRAINT fk_medicine_supplier
        FOREIGN KEY (supplier_id)
        REFERENCES supplier (supplier_id)
);