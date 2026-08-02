-- Migration: 0016
-- Table: doctor_availability
-- Purpose: Weekly schedule + exceptions per doctor.
-- Depends on: tenant, doctor_profile

CREATE TABLE doctor_availability (
    availability_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doctor_id        UUID NOT NULL,
    tenant_id        UUID NOT NULL,
    days             JSONB NOT NULL DEFAULT '[]',
    exceptions       JSONB NOT NULL DEFAULT '[]',
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_doctor_availability_tenant FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id) ON DELETE CASCADE,
    CONSTRAINT fk_doctor_availability_doctor FOREIGN KEY (doctor_id) REFERENCES doctor_profile(doctor_profile_id) ON DELETE CASCADE,
    CONSTRAINT uq_doctor_availability_doctor UNIQUE (doctor_id)
);

CREATE INDEX idx_doctor_availability_tenant ON doctor_availability(tenant_id);
