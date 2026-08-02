-- Migration: 0009
-- Table: setting
-- Purpose: Per-tenant key/value configuration.
-- Depends on: tenant, users

CREATE TABLE setting (
    setting_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL,
    key         VARCHAR(255) NOT NULL,
    value       TEXT,
    "group"     VARCHAR(100),
    updated_by  UUID,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_setting_tenant FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id) ON DELETE CASCADE,
    CONSTRAINT fk_setting_user   FOREIGN KEY (updated_by) REFERENCES users(user_id) ON DELETE SET NULL,
    CONSTRAINT uq_setting_tenant_key UNIQUE (tenant_id, key)
);

CREATE INDEX idx_setting_tenant ON setting(tenant_id);
