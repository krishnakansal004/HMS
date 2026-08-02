-- Migration: 0014
-- Table: doctor_profile
-- Purpose: Doctor-specific profile info attached to a user account.
-- Depends on: tenant, users

CREATE TABLE doctor_profile (
    doctor_profile_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id              UUID NOT NULL,
    tenant_id            UUID NOT NULL,
    designation          VARCHAR(255),
    specialization       VARCHAR(255),
    department_label     VARCHAR(255),
    qualifications       TEXT,
    registration_number  VARCHAR(100),
    experience_years     INT DEFAULT 0,
    consultation_fee     NUMERIC(10,2) DEFAULT 0,
    address              TEXT,
    active               BOOLEAN NOT NULL DEFAULT TRUE,
    created_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at           TIMESTAMP NULL,
    CONSTRAINT fk_doctor_profile_tenant FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id) ON DELETE CASCADE,
    CONSTRAINT fk_doctor_profile_user   FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    CONSTRAINT uq_doctor_profile_user UNIQUE (user_id),
    CONSTRAINT chk_doctor_profile_fee CHECK (consultation_fee >= 0),
    CONSTRAINT chk_doctor_profile_experience CHECK (experience_years >= 0)
);

CREATE INDEX idx_doctor_profile_tenant ON doctor_profile(tenant_id);
