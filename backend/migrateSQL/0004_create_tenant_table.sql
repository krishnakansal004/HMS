-- Migration: 0004
-- Table: tenant
-- Purpose: One row per hospital/clinic (root of multi-tenancy).
-- Depends on: plan

CREATE TABLE tenant (
    tenant_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(255) NOT NULL,
    slug        VARCHAR(255) UNIQUE,
    plan_id     UUID,
    status      VARCHAR(50) NOT NULL DEFAULT 'active',
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at  TIMESTAMP NULL,
    CONSTRAINT fk_tenant_plan FOREIGN KEY (plan_id) REFERENCES plan(plan_id) ON DELETE SET NULL,
    CONSTRAINT chk_tenant_status CHECK (status IN ('active', 'suspended', 'cancelled'))
);

CREATE INDEX idx_tenant_plan ON tenant(plan_id);
