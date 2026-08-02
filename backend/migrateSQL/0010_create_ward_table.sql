-- Migration: 0010
-- Table: ward
-- Purpose: Hospital wards (general, ICU, private, etc.) that beds belong to.
-- Depends on: tenant

CREATE TABLE ward (
    ward_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id          UUID NOT NULL,
    name               VARCHAR(255) NOT NULL,
    type               VARCHAR(100) NOT NULL,
    floor              VARCHAR(100),
    capacity           INT NOT NULL DEFAULT 0,
    price_per_day      NUMERIC(10,2) NOT NULL DEFAULT 0,
    current_occupancy  INT NOT NULL DEFAULT 0,
    is_active          BOOLEAN NOT NULL DEFAULT TRUE,
    created_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at         TIMESTAMP NULL,
    CONSTRAINT fk_ward_tenant FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id) ON DELETE CASCADE,
    CONSTRAINT chk_ward_capacity CHECK (capacity >= 0),
    CONSTRAINT chk_ward_price CHECK (price_per_day >= 0)
);

CREATE INDEX idx_ward_tenant ON ward(tenant_id);
