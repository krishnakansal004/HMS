-- Migration: 0041
-- Table: patient
-- Purpose: Adds emergency_contact, allergies, and medical_history.
--
-- These three fields were already accepted by registerPatientValidator
-- and updatePatientValidator, and patientService.updatePatient() was
-- already writing them onto the Prisma update -- but the columns never
-- existed on this table. Effect: PUT /api/patients/:id 500'd the moment
-- any of the three was sent (Prisma "Unknown argument"), and
-- POST /api/patients silently dropped them instead of persisting them
-- (registerPatient() never mapped them into patientData -- data loss,
-- not a crash, which is why the create path didn't surface it).
-- Depends on: patient (0012)
--
-- CORRECTED IN PLACE: the original version of this file used Prisma
-- schema syntax ("String?") instead of a Postgres type -- not valid SQL,
-- can't have ever run successfully. Fixed to plain nullable TEXT, matching
-- every other free-text field in this schema (address, notes, diagnosis,
-- etc.) and matching what schema.prisma's `String?` (no @db.VarChar
-- override) actually maps to for Postgres. IF NOT EXISTS added since this
-- migration may or may not have already been half-applied by hand outside
-- migration tracking -- safe to run either way.

ALTER TABLE patient
    ADD COLUMN IF NOT EXISTS emergency_contact TEXT,
    ADD COLUMN IF NOT EXISTS allergies         TEXT,
    ADD COLUMN IF NOT EXISTS medical_history   TEXT;
