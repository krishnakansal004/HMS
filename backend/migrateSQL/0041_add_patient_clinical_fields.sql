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
-- these are required for a patient record to exist.
-- Depends on: patient (0012)

ALTER TABLE patient
    ADD COLUMN emergency_contact String?,
    ADD COLUMN allergies         String?,
    ADD COLUMN medical_history   String?;
