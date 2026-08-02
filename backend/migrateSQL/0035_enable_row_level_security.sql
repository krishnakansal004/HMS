-- Migration: 0035
-- Purpose: Enable Postgres Row Level Security on every tenant-scoped table,
-- per the multi-tenant design agreed for this project.
--
-- HOW THIS WORKS:
-- Your tenant-scoping middleware (req.db / tenant middleware) must run, at
-- the start of every request inside a transaction, before any query:
--
--   SET LOCAL app.current_tenant_id = '<tenant-uuid-for-this-request>';
--
-- Every policy below compares tenant_id on the row to that session setting.
-- If app.current_tenant_id is never set, current_setting(..., true) returns
-- NULL, and the comparison (tenant_id = NULL) is never true -- so queries
-- simply return zero rows rather than leaking cross-tenant data. Fail-closed,
-- not fail-open.
--
-- FORCE ROW LEVEL SECURITY matters: without it, RLS is bypassed for whichever
-- Postgres role owns the table (typically the same role your backend
-- connects as), which silently defeats the whole point. FORCE closes that gap.

DO $$
DECLARE
    tbl TEXT;
    tenant_scoped_tables TEXT[] := ARRAY[
        'users', 'setting', 'ward', 'bed', 'patient', 'doctor_profile',
        'doctor_attendance', 'doctor_availability', 'appointment',
        'prescription', 'prescription_template', 'supplier', 'medicine',
        'purchase', 'purchase_item', 'insurance_company', 'plan_request',
        'invoice', 'invoice_item', 'insurance_claim', 'plan_receipt',
        'payment_request', 'expense', 'lab_test', 'lab_order', 'radiology_order'
    ];
BEGIN
    FOREACH tbl IN ARRAY tenant_scoped_tables LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', tbl);
        EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY;', tbl);
        EXECUTE format(
            'CREATE POLICY tenant_isolation_%I ON %I USING (tenant_id = current_setting(''app.current_tenant_id'', true)::uuid);',
            tbl, tbl
        );
    END LOOP;
END $$;

-- NOTE: tenant, plan, role, permission, role_permission, and plan_role_feature
-- are intentionally NOT in this list. tenant is the root of tenant scoping
-- (nothing scopes it further), and role/permission/role_permission/
-- plan_role_feature are a shared, platform-wide catalog, not per-hospital data.
