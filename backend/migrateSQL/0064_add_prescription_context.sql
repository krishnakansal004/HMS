-- Migration: 0064
-- Add the clinical context fields already accepted by the prescription API.

ALTER TABLE prescription
  ADD COLUMN IF NOT EXISTS appointment_id UUID,
  ADD COLUMN IF NOT EXISTS diagnosis TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_prescription_appointment'
  ) THEN
    ALTER TABLE prescription
      ADD CONSTRAINT fk_prescription_appointment
      FOREIGN KEY (tenant_id, appointment_id)
      REFERENCES appointment (tenant_id, appointment_id)
      ON DELETE RESTRICT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_prescription_appointment
  ON prescription (appointment_id);