-- Migration: 0017
-- Table: appointment
-- Purpose: Doctor-patient appointment bookings.
-- Depends on: tenant, doctor_profile, patient

CREATE TABLE appointment (
    appointment_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id             UUID NOT NULL,
    doctor_id             UUID NOT NULL,
    patient_id            UUID NOT NULL,
    doctor_name_snapshot  VARCHAR(255) NOT NULL,
    slot_start            TIMESTAMP NOT NULL,
    slot_end              TIMESTAMP NOT NULL,
    status                VARCHAR(50) NOT NULL DEFAULT 'scheduled',
    notes                 TEXT,
    created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at            TIMESTAMP NULL,
    CONSTRAINT fk_appointment_tenant  FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id) ON DELETE CASCADE,
    CONSTRAINT fk_appointment_patient FOREIGN KEY (patient_id) REFERENCES patient(patient_id) ON DELETE CASCADE,
    CONSTRAINT fk_appointment_doctor  FOREIGN KEY (doctor_id) REFERENCES doctor_profile(doctor_profile_id) ON DELETE CASCADE,
    CONSTRAINT chk_appointment_status CHECK (status IN ('scheduled', 'confirmed', 'completed', 'cancelled', 'no_show')),
    CONSTRAINT chk_appointment_slot CHECK (slot_end > slot_start)
);

CREATE INDEX idx_appointment_tenant ON appointment(tenant_id);
CREATE INDEX idx_appointment_doctor ON appointment(doctor_id);
CREATE INDEX idx_appointment_patient ON appointment(patient_id);
CREATE INDEX idx_appointment_tenant_status ON appointment(tenant_id, status);
