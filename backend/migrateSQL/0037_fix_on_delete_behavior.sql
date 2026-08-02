-- Migration: 0037
-- Purpose: Fixes an ON DELETE inconsistency found during review.
--
-- appointment.patient_id/doctor_id and prescription.patient_id/doctor_id were
-- set to CASCADE, meaning a hard-delete of a patient or doctor would silently
-- wipe their appointment/prescription history. Every other clinical/financial
-- table (invoice, insurance_claim, payment_request, lab_order,
-- radiology_order) correctly uses RESTRICT on patient_id for this exact
-- reason. Bringing these two tables in line: RESTRICT forces the application
-- to soft-delete (deleted_at) patients/doctors instead of hard-deleting them
-- while history exists.
--
-- Also tightening bed.ward_id from CASCADE to RESTRICT: deleting a ward
-- should not silently delete (potentially occupied) beds. Beds must be
-- explicitly removed/deactivated first.

ALTER TABLE appointment DROP CONSTRAINT fk_appointment_patient;
ALTER TABLE appointment ADD CONSTRAINT fk_appointment_patient
    FOREIGN KEY (patient_id) REFERENCES patient(patient_id) ON DELETE RESTRICT;

ALTER TABLE appointment DROP CONSTRAINT fk_appointment_doctor;
ALTER TABLE appointment ADD CONSTRAINT fk_appointment_doctor
    FOREIGN KEY (doctor_id) REFERENCES doctor_profile(doctor_profile_id) ON DELETE RESTRICT;

ALTER TABLE prescription DROP CONSTRAINT fk_prescription_patient;
ALTER TABLE prescription ADD CONSTRAINT fk_prescription_patient
    FOREIGN KEY (patient_id) REFERENCES patient(patient_id) ON DELETE RESTRICT;

ALTER TABLE prescription DROP CONSTRAINT fk_prescription_doctor;
ALTER TABLE prescription ADD CONSTRAINT fk_prescription_doctor
    FOREIGN KEY (doctor_id) REFERENCES doctor_profile(doctor_profile_id) ON DELETE RESTRICT;

ALTER TABLE bed DROP CONSTRAINT fk_bed_ward;
ALTER TABLE bed ADD CONSTRAINT fk_bed_ward
    FOREIGN KEY (ward_id) REFERENCES ward(ward_id) ON DELETE RESTRICT;
