-- Migration: 0054
-- Drops: patient.bed_id, patient.is_admitted, patient.admitted_at
--
-- These three columns were a second (and with `admission` counting, third)
-- independently-writable source of truth for "is this patient currently
-- admitted, and to which bed" -- the same fact already lives authoritatively
-- in bed.patient_id/bed.is_occupied and admission.bed_id/admission.status.
-- Nothing enforced agreement between the three, so they could (and per a
-- comment already in patientService.js -- "is_admitted is intentionally NOT
-- updated here" -- provably did) drift out of sync.
--
-- Run this only after the application-code changes below are deployed, not
-- before -- dropping a column a live INSERT still references will fail the
-- next write immediately with "column does not exist". Order matters here
-- more than in most of the migrations in this series, because unlike adding
-- a new table nothing else depends on, this is removing something two live
-- code paths currently write to.
--
-- Required code changes (verified against the current repo, both are
-- writes, neither has a corresponding read anywhere in the backend or
-- frontend, so removal is a clean delete, not a rewire):
--   - backend/src/services/authService.js:54    remove `is_admitted: false`
--     from the patient-creation payload
--   - backend/src/services/patientService.js:47 remove `is_admitted: false`
--     from the patient-creation payload
--   - backend/src/services/patientService.js:141 delete the now-stale
--     "is_admitted is intentionally NOT updated here" comment along with it
--
-- No repository, controller, validator, or frontend file reads any of the
-- three columns being dropped here (checked patientRepository.js,
-- patientValidator.js, patientController.js, and the full frontend/src
-- tree) -- if you've since added a read anywhere, find and fix it before
-- running this, since it isn't accounted for below.
--
-- Depends on: 0053 (this assumes patient/bed already have the composite
-- tenant-scoped FK structure from that migration)

-- The FK from patient -> bed goes first; you can't drop a column a
-- constraint still references.
ALTER TABLE patient DROP CONSTRAINT IF EXISTS fk_patient_bed;

ALTER TABLE patient DROP COLUMN IF EXISTS bed_id;
ALTER TABLE patient DROP COLUMN IF EXISTS is_admitted;
ALTER TABLE patient DROP COLUMN IF EXISTS admitted_at;

-- The idx_patient_bed index (on the now-dropped bed_id column) is dropped
-- automatically by Postgres along with the column -- no separate DROP INDEX
-- needed.
