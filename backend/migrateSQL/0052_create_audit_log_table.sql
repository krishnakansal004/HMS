-- Migration: 0045_create_audit_log_table.sql
-- Purpose: Create the missing audit log table defined in Prisma schema

CREATE TABLE audit_log (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL,
    user_id     UUID,
    action      VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id   VARCHAR(255),
    old_value   JSONB,
    new_value   JSONB,
    ip_address  VARCHAR(45),
    created_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_log_tenant ON audit_log(tenant_id);
CREATE INDEX idx_audit_log_tenant_created ON audit_log(tenant_id, created_at);

-- Do not apply Row Level Security (RLS) to this table as it operates in a background thread 
-- outside the standard HTTP request transaction context.