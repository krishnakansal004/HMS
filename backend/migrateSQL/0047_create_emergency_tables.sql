-- Migration: 0047
-- Tables: blood_bank, ambulance_dispatch, operation_theater (all new)
-- Phase: 3 — Emergency & Critical Care
--
-- Field names below match services/emergencyService.js EXACTLY -- that
-- service already exists, already imports db, and already calls
-- db.blood_bank.create/findMany, db.ambulance_dispatch.create, and
-- db.operation_theater.create with these exact field names. It's been
-- sitting unable to run for the same reason as hrmsService.js: written
-- ahead of the schema.
--
-- SCOPE NOTE: the legacy Mongoose files this replaces (routes/bloodbank.js,
-- routes/ambulance.js, routes/ot.js) implemented a much larger feature set
-- -- a full donor registry with vitals tracking, bag-level blood inventory
-- with expiry dates and crossmatch workflow, and a separate ambulance
-- vehicle fleet registry independent of dispatch records. emergencyService.js
-- deliberately does NOT reimplement any of that -- it tracks blood stock as
-- a single running total per blood group, dispatches ambulances without a
-- fleet registry (vehicle details are captured per-dispatch, not looked up
-- from a vehicle table), and schedules OT time without preop/postop clinical
-- notes. This migration follows that already-chosen simplified design
-- rather than the legacy one. If donor management, bag-level inventory, or
-- a vehicle registry turn out to be real requirements, that's a deliberate
-- follow-up decision to make with input from whoever chose to simplify
-- emergencyService.js in the first place -- not something to silently
-- re-expand here.
--
-- Depends on: tenant (0004), patient (existing), doctor_profile (existing)

CREATE TABLE blood_bank (
    blood_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id          UUID NOT NULL,
    blood_group        VARCHAR(5) NOT NULL,
    units_available    INT NOT NULL DEFAULT 0,
    storage_location   VARCHAR(150),
    created_at         TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at         TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_blood_bank_tenant FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id) ON DELETE CASCADE,
    CONSTRAINT chk_blood_bank_group CHECK (blood_group IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')),
    CONSTRAINT chk_blood_bank_units CHECK (units_available >= 0),
    CONSTRAINT uq_blood_bank_tenant_group UNIQUE (tenant_id, blood_group)
);

CREATE INDEX idx_blood_bank_tenant ON blood_bank(tenant_id);

ALTER TABLE blood_bank ENABLE ROW LEVEL SECURITY;
ALTER TABLE blood_bank FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_blood_bank ON blood_bank
  USING (tenant_id = (current_setting('app.current_tenant_id', true))::uuid);

CREATE TRIGGER trg_blood_bank_updated_at BEFORE UPDATE ON blood_bank
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


CREATE TABLE ambulance_dispatch (
    dispatch_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id          UUID NOT NULL,
    patient_id         UUID,
    vehicle_number     VARCHAR(30) NOT NULL,
    driver_name        VARCHAR(150),
    driver_phone       VARCHAR(20),
    destination        TEXT,
    emergency_level     VARCHAR(20) NOT NULL DEFAULT 'URGENT',
    status             VARCHAR(20) NOT NULL DEFAULT 'DISPATCHED',
    dispatched_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    completed_at       TIMESTAMPTZ,
    created_by         UUID,
    created_at         TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at         TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_ambulance_dispatch_tenant FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id) ON DELETE CASCADE,
    CONSTRAINT fk_ambulance_dispatch_patient FOREIGN KEY (patient_id) REFERENCES patient(patient_id) ON DELETE SET NULL,
    CONSTRAINT fk_ambulance_dispatch_creator FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL,
    CONSTRAINT chk_ambulance_dispatch_level CHECK (emergency_level IN ('MODERATE', 'URGENT', 'CRITICAL')),
    CONSTRAINT chk_ambulance_dispatch_status CHECK (status IN ('DISPATCHED', 'EN_ROUTE', 'COMPLETED', 'CANCELLED'))
);

CREATE INDEX idx_ambulance_dispatch_tenant ON ambulance_dispatch(tenant_id);
CREATE INDEX idx_ambulance_dispatch_tenant_status ON ambulance_dispatch(tenant_id, status);

ALTER TABLE ambulance_dispatch ENABLE ROW LEVEL SECURITY;
ALTER TABLE ambulance_dispatch FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_ambulance_dispatch ON ambulance_dispatch
  USING (tenant_id = (current_setting('app.current_tenant_id', true))::uuid);

CREATE TRIGGER trg_ambulance_dispatch_updated_at BEFORE UPDATE ON ambulance_dispatch
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


CREATE TABLE operation_theater (
    surgery_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id          UUID NOT NULL,
    patient_id         UUID NOT NULL,
    doctor_id          UUID,
    ot_room_number      VARCHAR(30) NOT NULL DEFAULT 'OT Room 1',
    surgery_name        VARCHAR(255) NOT NULL,
    scheduled_at        TIMESTAMPTZ NOT NULL,
    duration_minutes    INT DEFAULT 60,
    status             VARCHAR(20) NOT NULL DEFAULT 'SCHEDULED',
    notes              JSONB DEFAULT '{}',
    price              NUMERIC(10, 2) DEFAULT 0,
    billing_status      VARCHAR(20) DEFAULT 'pending',
    completed_at        TIMESTAMPTZ,
    created_by          UUID,
    created_at          TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_operation_theater_tenant FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id) ON DELETE CASCADE,
    CONSTRAINT fk_operation_theater_patient FOREIGN KEY (patient_id) REFERENCES patient(patient_id) ON DELETE CASCADE,
    CONSTRAINT fk_operation_theater_doctor FOREIGN KEY (doctor_id) REFERENCES doctor_profile(doctor_profile_id) ON DELETE SET NULL,
    CONSTRAINT fk_operation_theater_creator FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL,
    CONSTRAINT chk_operation_theater_status CHECK (status IN ('SCHEDULED', 'ONGOING', 'COMPLETED', 'CANCELLED'))
);

CREATE INDEX idx_operation_theater_tenant ON operation_theater(tenant_id);
CREATE INDEX idx_operation_theater_tenant_scheduled ON operation_theater(tenant_id, scheduled_at);
CREATE INDEX idx_operation_theater_patient ON operation_theater(patient_id);

ALTER TABLE operation_theater ENABLE ROW LEVEL SECURITY;
ALTER TABLE operation_theater FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_operation_theater ON operation_theater
  USING (tenant_id = (current_setting('app.current_tenant_id', true))::uuid);

CREATE TRIGGER trg_operation_theater_updated_at BEFORE UPDATE ON operation_theater
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- NOTE ON doctor_profile FK: emergencyService.scheduleSurgery({ doctorId, ... })
-- currently accepts a bare doctorId with no clarification of whether it's a
-- users.user_id or a doctor_profile.doctor_profile_id. This migration FKs
-- to doctor_profile.doctor_profile_id (matching the pattern operation_theater
-- shares with appointment.doctor_id... except appointment doesn't actually
-- FK doctor_id at all, it denormalizes doctor_name_snapshot instead -- worth
-- checking against when the emergency controller/route layer gets built,
-- since the service will need to resolve a users.user_id to a
-- doctor_profile_id the same way the attendance fix in the previous round
-- had to for a related reason).
