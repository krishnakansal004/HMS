-- Migration: 0045
-- Tables: leave (new), shift (new)
-- Phase: 2A — HR Core
--
-- These two tables aren't a guess — services/hrmsService.js already exists
-- and already calls db.leave.create/update and db.shift.create with these
-- exact field names (tenant_id, user_id, start_date, end_date, reason,
-- status / tenant_id, name, start_time, end_time). That service was written
-- ahead of the schema and has been sitting unable to run. This migration
-- makes it match reality; the shift table adds two nullable columns
-- (ward_id, user_id) beyond what hrmsService.createShift touches today,
-- carried over from the legacy routes/shifts.js design (assigning a shift
-- to a ward and/or a specific staff member) since that's clearly the
-- intended full feature -- hrmsService.js's current createShift() just
-- hasn't been extended to accept them yet.
--
-- "Staff" here is `users` directly, not a separate staff table -- see
-- hrmsService.listStaff(), which already queries db.users. There is no
-- separate staff entity in this schema; a staff member is a user with a
-- non-DOCTOR-only role.
--
-- Depends on: tenant (0004), users (0005), ward (existing)

CREATE TABLE leave (
    leave_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id    UUID NOT NULL,
    user_id      UUID NOT NULL,
    start_date   DATE NOT NULL,
    end_date     DATE NOT NULL,
    reason       TEXT,
    status       VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    reviewed_by  UUID,
    reviewed_at  TIMESTAMPTZ,
    created_at   TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_leave_tenant FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id) ON DELETE CASCADE,
    CONSTRAINT fk_leave_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    CONSTRAINT fk_leave_reviewer FOREIGN KEY (reviewed_by) REFERENCES users(user_id) ON DELETE SET NULL,
    CONSTRAINT chk_leave_status CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    CONSTRAINT chk_leave_dates CHECK (end_date >= start_date)
);

CREATE INDEX idx_leave_tenant ON leave(tenant_id);
CREATE INDEX idx_leave_user ON leave(user_id);
CREATE INDEX idx_leave_tenant_status ON leave(tenant_id, status);

ALTER TABLE leave ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_leave ON leave
  USING (tenant_id = (current_setting('app.current_tenant_id', true))::uuid);

CREATE TRIGGER trg_leave_updated_at BEFORE UPDATE ON leave
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


CREATE TABLE shift (
    shift_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id    UUID NOT NULL,
    name         VARCHAR(100) NOT NULL,
    ward_id      UUID,
    user_id      UUID,
    start_time   TIMESTAMPTZ NOT NULL,
    end_time     TIMESTAMPTZ NOT NULL,
    handover_note TEXT,
    created_at   TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_shift_tenant FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id) ON DELETE CASCADE,
    CONSTRAINT fk_shift_ward FOREIGN KEY (ward_id) REFERENCES ward(ward_id) ON DELETE SET NULL,
    CONSTRAINT fk_shift_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL,
    CONSTRAINT chk_shift_times CHECK (end_time > start_time)
);

CREATE INDEX idx_shift_tenant ON shift(tenant_id);
CREATE INDEX idx_shift_user ON shift(user_id);
CREATE INDEX idx_shift_tenant_start ON shift(tenant_id, start_time);

ALTER TABLE shift ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_shift ON shift
  USING (tenant_id = (current_setting('app.current_tenant_id', true))::uuid);

CREATE TRIGGER trg_shift_updated_at BEFORE UPDATE ON shift
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
