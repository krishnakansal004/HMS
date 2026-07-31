-- Create Purchase Table

CREATE TABLE purchase (
    purchase_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    supplier_id UUID NOT NULL,
    order_date DATE NOT NULL,
    total_cost NUMERIC(10,2) NOT NULL,
    status VARCHAR(50) NOT NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,

    CONSTRAINT fk_purchase_tenant
        FOREIGN KEY (tenant_id)
        REFERENCES tenant (tenant_id),

    CONSTRAINT fk_purchase_supplier
        FOREIGN KEY (supplier_id)
        REFERENCES supplier (supplier_id)
);