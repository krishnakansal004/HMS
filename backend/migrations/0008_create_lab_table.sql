-- Create Lab Test Table

CREATE TABLE lab_test (
    test_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(100) NOT NULL,
    category VARCHAR(100) NOT NULL,
    price NUMERIC(10,2) NOT NULL,
    parameters JSONB,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,

    CONSTRAINT fk_lab_test_tenant
        FOREIGN KEY (tenant_id)
        REFERENCES tenant (tenant_id)
);