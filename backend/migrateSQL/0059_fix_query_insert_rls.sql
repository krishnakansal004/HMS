-- Migration: 0059
--
-- the inline `(SELECT role_id FROM role WHERE name = 'SYSTEM_OWNER')` subquery is
-- uncorrelated (it references no column of the outer `users` row), and

CREATE OR REPLACE FUNCTION get_system_owner_role_id()
RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT role_id FROM role WHERE name = 'SYSTEM_OWNER';
$$;

DROP POLICY IF EXISTS tenant_isolation_users ON users;
CREATE POLICY tenant_isolation_users ON users
  USING (
    tenant_id = (current_setting('app.current_tenant_id', true))::uuid
    OR role_id = get_system_owner_role_id()
  );

-- Same reasoning as the original 0059: WITH CHECK stays strict (no
-- SYSTEM_OWNER exception) so this only loosens what can be *read* under
-- no tenant context, not who can create/modify a SYSTEM_OWNER row.
ALTER POLICY tenant_isolation_users ON users
  WITH CHECK (tenant_id = (current_setting('app.current_tenant_id', true))::uuid);