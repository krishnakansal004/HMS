-- Migration: 0043
-- Tables: admission (new), bed (altered)
-- Purpose: Three fixes surfaced by tracing admissionService.js /
-- admissionRepository.js / wardBedRepository.js against the real schema
-- for A4 (transaction boundaries):
--
-- 1. There is no `admission` table at all. AdmissionRepository already
--    calls db.admission.create/findFirst/update assuming one exists with
--    a specific shape -- every admission-related request fails
--    immediately today, not just the transaction-boundary issue this
--    migration was originally scoped to fix. Table built to match what
--    the repository already expects field-for-field.
-- 2. WardBedRepository.createBed() writes `price_per_day` onto `bed`,
--    but only `ward` has that column -- addBed()'s optional per-bed
--    price override (a real, sensible feature: a window bed can cost
--    more than others in the same ward) has never been able to persist.
-- 3. WardBedRepository.findWards() selects `status` on `bed`, which
--    doesn't exist (`is_occupied` boolean is the real column) -- fixed
--    in code, not here, nothing to migrate for that one.
--
-- status is lowercase, matching every other status-like CHECK constraint
-- in this schema (see the appointment fix in 0042 for why: the
-- application layer had drifted to uppercase in that module, and rather
-- than repeat that mismatch here, this table is defined correctly from
-- the start, with the app layer written to match).
--
-- Depends on: tenant (0004), patient (0012), bed (0011), doctor_profile (0014)

ALTER TABLE bed ADD COLUMN price_per_day NUMERIC(10,2);
ALTER TABLE bed ADD CONSTRAINT chk_bed_price CHECK (price_per_day IS NULL OR price_per_day >= 0);

CREATE TABLE admission (
    admission_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id             UUID NOT NULL,
    patient_id            UUID NOT NULL,
    bed_id                UUID,
    admitting_doctor_id   UUID,
    diagnosis             TEXT,
    admission_date        TIMESTAMPTZ NOT NULL DEFAULT now(),
    status                VARCHAR(20) NOT NULL DEFAULT 'admitted',
    discharge_date        TIMESTAMPTZ,
    discharge_notes       TEXT,
    created_at            TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at            TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    deleted_at            TIMESTAMPTZ,
    CONSTRAINT fk_admission_tenant  FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id) ON DELETE CASCADE,
    CONSTRAINT fk_admission_patient FOREIGN KEY (patient_id) REFERENCES patient(patient_id) ON DELETE CASCADE,
    CONSTRAINT fk_admission_bed     FOREIGN KEY (bed_id) REFERENCES bed(bed_id) ON DELETE SET NULL,
    CONSTRAINT fk_admission_doctor  FOREIGN KEY (admitting_doctor_id) REFERENCES doctor_profile(doctor_profile_id) ON DELETE SET NULL,
    CONSTRAINT chk_admission_status CHECK (status IN ('admitted', 'discharged', 'transferred', 'cancelled'))
);

CREATE INDEX idx_admission_tenant ON admission(tenant_id);
CREATE INDEX idx_admission_patient ON admission(patient_id);
CREATE INDEX idx_admission_bed ON admission(bed_id);
CREATE INDEX idx_admission_tenant_status ON admission(tenant_id, status);

ALTER TABLE admission ENABLE ROW LEVEL SECURITY;
ALTER TABLE admission FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_admission ON admission
  USING (tenant_id = (current_setting('app.current_tenant_id', true))::uuid);

CREATE TRIGGER trg_admission_updated_at BEFORE UPDATE ON admission
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
