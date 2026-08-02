-- Migration: 0019
-- Table: prescription_template
-- Purpose: Reusable prescription templates a doctor can start from.
-- Depends on: tenant, users

CREATE TABLE prescription_template (
    template_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id    UUID NOT NULL,
    name         VARCHAR(255) NOT NULL,
    medicines    JSONB NOT NULL DEFAULT '[]',
    tests        JSONB NOT NULL DEFAULT '[]',
    html         TEXT,
    created_by   UUID NOT NULL,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at   TIMESTAMP NULL,
    CONSTRAINT fk_prescription_template_tenant FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id) ON DELETE CASCADE,
    CONSTRAINT fk_prescription_template_user   FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE INDEX idx_prescription_template_tenant ON prescription_template(tenant_id);
