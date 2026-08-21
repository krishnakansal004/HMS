-- Migration: 0044
-- Tables: attendance (new)
-- Purpose: There is no generic staff attendance table at all. attendanceService.js
-- / attendanceRepository.js / attendanceController.js / routes/attendance.js were
-- all written and wired end-to-end for one -- calling db.attendance.create/update/
-- findMany with camelCase fields (userId, date, checkIn, checkOut) -- but no such
-- Prisma model or Postgres table exists. Every request to
-- POST /api/attendance/check-in|check-out or GET /api/attendance fails immediately.
--
-- This is NOT the same thing as `doctor_attendance` (migration 0004-era, already
-- live). doctor_attendance is FK'd to doctor_profile, so only users with a doctor
-- profile can ever have a row there. But routes/attendance.js explicitly grants
-- check-in/check-out to HOSPITAL_ADMIN, HR, DOCTOR, NURSE, RECEPTIONIST, PHARMACIST,
-- and LAB_TECHNICIAN -- five of those seven roles have no doctor_profile row and
-- structurally cannot be represented in doctor_attendance no matter how the code
-- is fixed. This table is scoped to `users` directly instead, matching what the
-- route/RBAC layer actually intends: hospital-wide staff attendance, not
-- doctor-only. doctor_attendance is untouched and remains the doctor-specific
-- schedule/roster table it already was.
--
-- Depends on: tenant (0004), users (0005)

CREATE TABLE attendance (
    attendance_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id      UUID NOT NULL,
    user_id        UUID NOT NULL,
    attendance_date DATE NOT NULL,
    status         VARCHAR(20) NOT NULL DEFAULT 'PRESENT',
    check_in_at    TIMESTAMPTZ,
    check_out_at   TIMESTAMPTZ,
    created_at     TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at     TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_attendance_tenant FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id) ON DELETE CASCADE,
    CONSTRAINT fk_attendance_user   FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    CONSTRAINT chk_attendance_status CHECK (status IN ('PRESENT', 'LEAVE', 'HALF_DAY')),
    -- Mirrors the exact business rule attendanceService.checkIn() already
    -- enforces in application code ("one attendance record per user per day") --
    -- this makes it a real guarantee instead of a race-prone app-layer check.
    CONSTRAINT uq_attendance_user_day UNIQUE (user_id, attendance_date)
);

CREATE INDEX idx_attendance_tenant ON attendance(tenant_id);
CREATE INDEX idx_attendance_user ON attendance(user_id);
CREATE INDEX idx_attendance_tenant_date ON attendance(tenant_id, attendance_date);

ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_attendance ON attendance
  USING (tenant_id = (current_setting('app.current_tenant_id', true))::uuid);

CREATE TRIGGER trg_attendance_updated_at BEFORE UPDATE ON attendance
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
