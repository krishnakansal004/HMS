-- Migration: 0011
-- Table: bed
-- Purpose: Individual beds within a ward.
-- Depends on: tenant, ward
--
-- IMPORTANT: patient_id is stored here but its FK constraint is intentionally
-- NOT added in this file. bed <-> patient is a circular reference (bed.patient_id
-- references patient, and patient.bed_id references bed), and patient does not
-- exist yet at this point in the migration order. The fk_bed_patient constraint
-- is added afterwards in 0013_alter_bed_add_patient_fk.sql once patient exists.

CREATE TABLE bed (
    bed_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ward_id      UUID NOT NULL,
    tenant_id    UUID NOT NULL,
    bed_number   VARCHAR(50) NOT NULL,
    is_occupied  BOOLEAN NOT NULL DEFAULT FALSE,
    patient_id   UUID,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at   TIMESTAMP NULL,
    CONSTRAINT fk_bed_tenant FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id) ON DELETE CASCADE,
    CONSTRAINT fk_bed_ward   FOREIGN KEY (ward_id) REFERENCES ward(ward_id) ON DELETE CASCADE,
    CONSTRAINT uq_bed_ward_number UNIQUE (ward_id, bed_number)
);

CREATE INDEX idx_bed_tenant ON bed(tenant_id);
CREATE INDEX idx_bed_ward ON bed(ward_id);
