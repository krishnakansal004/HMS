-- Migration: 0046
-- Tables: doctor_application (new)
-- Phase: 2B — Doctor Lifecycle
--
-- Backs the public "apply to join as a doctor" flow. tenant_id is NOT
-- nullable here -- the legacy routes/public.js's /doctor-apply endpoint
-- always required a tenantId in the request body (the applicant picks
-- which hospital they're applying to from a dropdown backed by
-- GET /public/hospitals), so every application always belongs to exactly
-- one tenant, even though the person applying doesn't have a user account
-- in that tenant yet.
--
-- On approval, DoctorManagementService (services/doctorManagementService.js
-- -- currently an empty stub, needs writing) is expected to: create a
-- `users` row with role DOCTOR, create a `doctor_profile` row, and set
-- reviewed_by/reviewed_at/status here. That flow already exists in the
-- legacy routes/doctorApplications.js for reference (setup-token email,
-- not auto-password) -- reimplement it against Prisma, don't invent a new
-- flow.
--
-- Depends on: tenant (0004), users (0005)

CREATE TABLE doctor_application (
    application_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id          UUID NOT NULL,
    name               VARCHAR(150) NOT NULL,
    email              VARCHAR(255) NOT NULL,
    phone              VARCHAR(20),
    specialization     VARCHAR(150) NOT NULL,
    department         VARCHAR(150),
    education          TEXT,
    years_experience   INT,
    address            TEXT,
    message            TEXT,
    status             VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    reviewed_by        UUID,
    reviewed_at        TIMESTAMPTZ,
    created_at         TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at         TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_doctor_application_tenant FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id) ON DELETE CASCADE,
    CONSTRAINT fk_doctor_application_reviewer FOREIGN KEY (reviewed_by) REFERENCES users(user_id) ON DELETE SET NULL,
    CONSTRAINT chk_doctor_application_status CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED'))
);

-- Mirrors the legacy duplicate-application guard ("email + status=pending"
-- query in routes/public.js) as a real partial unique index instead of an
-- app-layer check-then-insert race.
CREATE UNIQUE INDEX uq_doctor_application_pending_email
  ON doctor_application(tenant_id, email) WHERE (status = 'PENDING');

CREATE INDEX idx_doctor_application_tenant ON doctor_application(tenant_id);
CREATE INDEX idx_doctor_application_tenant_status ON doctor_application(tenant_id, status);

ALTER TABLE doctor_application ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctor_application FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_doctor_application ON doctor_application
  USING (tenant_id = (current_setting('app.current_tenant_id', true))::uuid);

CREATE TRIGGER trg_doctor_application_updated_at BEFORE UPDATE ON doctor_application
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- NOTE: the public application-submission endpoint (POST /apply) runs
-- BEFORE the applicant has any tenant session, so it can't rely on
-- SET LOCAL app.current_tenant_id being set from a logged-in user's
-- tenant_id the way every other write in this app does. The insert must
-- explicitly SET LOCAL app.current_tenant_id to the tenantId taken from
-- the request body (after validating that tenant exists) inside its own
-- transaction, the same way tenant provisioning already has to handle a
-- pre-auth write. See tenantPlanService.js's provisioning flow for the
-- existing precedent instead of inventing a new pattern.
