-- Migration: 0013
-- Purpose: Completes the circular bed <-> patient reference now that patient exists.
-- Depends on: bed (0011), patient (0012)

ALTER TABLE bed
    ADD CONSTRAINT fk_bed_patient FOREIGN KEY (patient_id) REFERENCES patient(patient_id) ON DELETE SET NULL;

CREATE INDEX idx_bed_patient ON bed(patient_id);
