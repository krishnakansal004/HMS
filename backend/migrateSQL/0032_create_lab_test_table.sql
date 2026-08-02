-- Migration: 0032
-- Table: lab_test
-- Purpose: Catalog of available lab tests (not the orders themselves).
-- Depends on: tenant

CREATE TABLE lab_test (
    test_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id        UUID NOT NULL,
    name             VARCHAR(255) NOT NULL,
    code             VARCHAR(100) NOT NULL,
    category         VARCHAR(100),
    sample_type      VARCHAR(100),
    price            NUMERIC(10,2) NOT NULL DEFAULT 0,
    reference_range  TEXT,
    parameters       JSONB,
    status           VARCHAR(50) NOT NULL DEFAULT 'active',
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at       TIMESTAMP NULL,
    CONSTRAINT fk_lab_test_tenant FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id) ON DELETE CASCADE,
    CONSTRAINT uq_lab_test_tenant_code UNIQUE (tenant_id, code),
    CONSTRAINT chk_lab_test_price CHECK (price >= 0),
    CONSTRAINT chk_lab_test_status CHECK (status IN ('active', 'inactive'))
);

CREATE INDEX idx_lab_test_tenant ON lab_test(tenant_id);
