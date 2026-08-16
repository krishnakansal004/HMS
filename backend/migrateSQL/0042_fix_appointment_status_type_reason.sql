-- Migration: 0042
-- Table: appointment
-- Purpose: Three fixes surfaced by running the full migration chain
-- against a real Postgres instance and then tracing appointmentService.js
-- / appointmentRepository.js / appointmentValidator.js against the
-- resulting schema:
--
-- 1. chk_appointment_status only allowed ('scheduled', 'confirmed',
--    'completed', 'cancelled', 'no_show'), but the application layer
--    (validator, service, frontend) already assumed a richer lifecycle
--    including 'checked_in' and 'in_progress' -- real, useful states for
--    a front-desk/consultation workflow. Extending the DB to match what
--    the app layer already intended, rather than removing functionality
--    that was already built.
-- 2. `type` (walk-in vs online) was accepted by bookAppointmentValidator
--    and passed through the service, but the `appointment` table never
--    had a column for it -- AppointmentRepository.create() silently
--    dropped it. Same shape of bug as the patient allergies/medicalHistory
--    fix from the previous session.
-- 3. `reason` (optional free-text note on a status change, e.g. why an
--    appointment was cancelled) was accepted by updateStatusValidator and
--    referenced by the service/audit log, but never had a column either.
--
-- Depends on: appointment (0017)

ALTER TABLE appointment DROP CONSTRAINT chk_appointment_status;

ALTER TABLE appointment ADD CONSTRAINT chk_appointment_status
  CHECK (status IN ('scheduled', 'confirmed', 'checked_in', 'in_progress', 'completed', 'cancelled', 'no_show'));

ALTER TABLE appointment
  ADD COLUMN type   VARCHAR(20) NOT NULL DEFAULT 'walk_in',
  ADD COLUMN reason TEXT;

ALTER TABLE appointment ADD CONSTRAINT chk_appointment_type
  CHECK (type IN ('online', 'walk_in'));
