-- Migration: 0007
-- Table: users
-- Purpose: All system users (director/admin/subadmin/doctor/patient logins).
-- Depends on: tenant, role

CREATE TABLE users (
    user_id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL,
    role_id                 UUID NOT NULL,
    name                    VARCHAR(255),
    email                   VARCHAR(255) NOT NULL,
    password_hash           TEXT,
    must_change_password    BOOLEAN NOT NULL DEFAULT FALSE,
    password_reset_token    VARCHAR(255),
    password_reset_expires  TIMESTAMP,
    created_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at              TIMESTAMP NULL,
    -- Email uniqueness is per-tenant, not global -- two different hospitals
    -- can have a user with the same email address.
    CONSTRAINT uq_user_tenant_email UNIQUE (tenant_id, email),
    CONSTRAINT fk_user_tenant FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id) ON DELETE CASCADE,
    CONSTRAINT fk_user_role   FOREIGN KEY (role_id) REFERENCES role(role_id) ON DELETE RESTRICT
);

CREATE INDEX idx_user_tenant ON users(tenant_id);
CREATE INDEX idx_user_role ON users(role_id);
