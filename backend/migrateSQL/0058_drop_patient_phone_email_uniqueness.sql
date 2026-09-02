-- Migration: 0057
-- Table: patient
-- Purpose: (1) two patients at the same hospital sharing a phone number
-- or email is a normal, common scenario (family members, caregivers,
-- elderly dependents without their own contact details) -- the hard
-- UNIQUE constraints from 0012 made that structurally impossible at the
-- database level. (2) medical_record_number was flagged as a dead
-- reference since the very first audit pass on this codebase and is
-- being removed for good, not decided on later -- there was never a
-- column for it, so there's nothing to drop at the DB level; this
-- migration's job is just phone/email.
--
-- Decision, confirmed: phone and email are BOTH dropped as hard
-- constraints. No replacement uniqueness rule is being added for either
-- at the database level in this migration -- if you want a softer
-- "warn, don't block" duplicate-email check specifically (the "email may
-- deserve a separate business rule" note), that's an application-layer
-- UX feature to design deliberately, not something to bolt onto this
-- migration by guessing at what it should do.
--
-- Depends on: patient (0012)

ALTER TABLE patient DROP CONSTRAINT IF EXISTS uk_tenant_phone;
ALTER TABLE patient DROP CONSTRAINT IF EXISTS uk_tenant_email;

-- The two indexes Postgres auto-created to back those UNIQUE constraints
-- are dropped along with them -- no separate DROP INDEX needed. If you
-- want phone/email lookups to stay fast (patientRepository.findByEmailOrPhone
-- is still used as a general "find existing patient" search, just no
-- longer as a blocking gate -- see the code changes in this package),
-- add plain non-unique indexes instead:
CREATE INDEX IF NOT EXISTS idx_patient_tenant_phone ON patient(tenant_id, phone);
CREATE INDEX IF NOT EXISTS idx_patient_tenant_email ON patient(tenant_id, email);
