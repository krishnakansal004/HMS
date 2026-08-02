-- Migration: 0015
-- Table: doctor_attendance
-- Purpose: Daily attendance log per doctor.
-- Depends on: tenant, doctor_profile
-- NOTE: fixes typo from the earlier draft ("doctor_attendace" -> "doctor_attendance").
-- Also drops the redundant is_present boolean (status is the single source of
-- truth now) and makes check_out_at nullable so a check-in-only row is valid.

CREATE TABLE doctor_attendance (
    doctor_attendance_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doctor_id             UUID NOT NULL,
    tenant_id             UUID NOT NULL,
    attendance_date       DATE NOT NULL,
    status                VARCHAR(20) NOT NULL DEFAULT 'present',
    check_in_at           TIMESTAMP,
    check_out_at          TIMESTAMP,
    notes                 TEXT,
    created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_doctor_attendance_tenant FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id) ON DELETE CASCADE,
    CONSTRAINT fk_doctor_attendance_doctor FOREIGN KEY (doctor_id) REFERENCES doctor_profile(doctor_profile_id) ON DELETE CASCADE,
    CONSTRAINT uq_doctor_attendance_day UNIQUE (doctor_id, attendance_date),
    CONSTRAINT chk_doctor_attendance_status CHECK (status IN ('present', 'absent', 'half_day', 'on_leave'))
);

CREATE INDEX idx_doctor_attendance_tenant ON doctor_attendance(tenant_id);
CREATE INDEX idx_doctor_attendance_doctor ON doctor_attendance(doctor_id);
