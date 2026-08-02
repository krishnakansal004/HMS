-- Migration: 0002
-- Table: role
-- Purpose: Formal role catalog (director/admin/subadmin/doctor/patient, extensible).
-- Depends on: none

CREATE TABLE role (
    role_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name         VARCHAR(100) NOT NULL UNIQUE,
    description  TEXT,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at   TIMESTAMP NULL
);
