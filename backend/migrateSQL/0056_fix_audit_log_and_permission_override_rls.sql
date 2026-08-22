-- Migration: 0056
-- Fixes: audit_log and user_permission_override both have zero tenant
-- isolation right now -- neither has ever had RLS applied anywhere in
-- this migration series.
--
-- audit_log (0052) was deliberately left unprotected with the stated
-- reason "it operates in a background thread outside the standard HTTP
-- request transaction context." That's not accurate: AuditService.logAction()
-- runs in the same process, same request lifecycle, and the same `db`
-- tenant-context wrapper as every other write in this app -- it's called
-- without being awaited (fire-and-forget, wrapped in .catch() so a logging
-- failure never fails the actual request), which is not the same thing as
-- running outside the transaction/tenant context. This is the highest-value
-- single target for a cross-tenant leak in the whole schema: it's a running
-- record of exactly the sensitive stuff (patient record changes, who did
-- what, IP addresses, and old_value/new_value snapshots that can contain
-- PHI). Any future feature that queries it without manually re-adding a
-- WHERE tenant_id filter -- the exact class of mistake RLS exists to catch
-- as a backstop -- currently returns every tenant's audit trail.
--
-- user_permission_override (0008) was simply never RLS'd at all, and has
-- no tenant_id column of its own to filter on -- it only reaches a tenant
-- indirectly via user_id -> users.tenant_id. Same shape of gap chat_message
-- had before 0053 fixed it with a join-based policy; fixed the same way
-- here.
--
-- IMPORTANT, READ BEFORE RUNNING: once FORCE ROW LEVEL SECURITY is applied
-- to audit_log, every INSERT into it needs app.current_tenant_id set in the
-- same transaction, or the write itself gets rejected -- exactly the
-- tenant-provisioning bug fixed in Round 4's tenantPlanRepository.js fix.
-- Before running this migration, confirm AuditService.logAction() writes
-- through the wrapped `db` client (config/db.js), not the raw `prisma`
-- client -- if it's using raw `prisma` (which the "background thread"
-- comment in 0052 suggests someone may have deliberately chosen, reasoning
-- from the same incorrect premise), every audit log write will start
-- failing the moment this migration runs. Grep for
-- `import { prisma }` vs `import { db }` at the top of auditService.js
-- to check before you run this against production.

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_audit_log ON audit_log
  USING (tenant_id = (current_setting('app.current_tenant_id', true))::uuid);

ALTER TABLE user_permission_override ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_permission_override FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_user_permission_override ON user_permission_override
  USING (EXISTS (
    SELECT 1 FROM users
    WHERE users.user_id = user_permission_override.user_id
    AND users.tenant_id = (current_setting('app.current_tenant_id', true))::uuid
  ));
