-- Migration: 0055
-- Fixes: the OR tenant_id IS NULL RLS leak on `query`, `customization_request`,
-- and `chat_session` -- still open after 0053, which only fixed chat_message.
--
-- Original policies (from 0049/0050) read:
--   USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid
--          OR tenant_id IS NULL)
-- Any row with a NULL tenant_id satisfies the second branch for every
-- tenant's session independently -- every hospital using this app can read
-- every other hospital's unassigned public leads (name, email, phone,
-- message) and, worse, every anonymous/unassigned chat_session's messages,
-- which is a live-conversation leak, not just a lead-list one.
--
-- `faq` and `chat_model` are DELIBERATELY left untouched below -- they hold
-- reference content and chatbot configuration, not personal data. A global
-- FAQ or a global chatbot prompt template being visible to every tenant is
-- the intended behavior, not a leak. Don't apply this same fix there.
--
-- The fix: tighten the RLS policy to strict tenant-only visibility (no OR
-- clause), so a NULL-tenant row becomes invisible to every ordinary tenant
-- session -- correctly private, not silently shared. `tenant_id` stays
-- nullable on the column itself (a genuinely unassigned lead is a real
-- business state), the column doesn't change, only who's allowed to *read*
-- an unassigned row does. A System Owner reviewing/triaging unassigned
-- leads needs a separate, explicit, hard-role-gated code path — a
-- controller method using the raw (non-tenant-wrapped) `prisma` client with
-- `where: { tenant_id: null }` and a `requireRoles('SYSTEM_OWNER')` check —
-- not a permissive RLS policy every tenant session can also exploit. That
-- controller method doesn't exist yet; this migration only closes the leak,
-- it doesn't build the replacement admin view. Flag if you want that built
-- next.

DROP POLICY IF EXISTS tenant_isolation_query ON query;
CREATE POLICY tenant_isolation_query ON query
  USING (tenant_id = (current_setting('app.current_tenant_id', true))::uuid);

DROP POLICY IF EXISTS tenant_isolation_customization_request ON customization_request;
CREATE POLICY tenant_isolation_customization_request ON customization_request
  USING (tenant_id = (current_setting('app.current_tenant_id', true))::uuid);

DROP POLICY IF EXISTS tenant_isolation_chat_session ON chat_session;
CREATE POLICY tenant_isolation_chat_session ON chat_session
  USING (tenant_id = (current_setting('app.current_tenant_id', true))::uuid);

-- chat_message's policy (added in 0053) already joins back to chat_session
-- and checks strict equality with no OR clause, so tightening chat_session
-- here doesn't require any change to chat_message's policy -- a message
-- whose parent session now fails the strict check was already going to
-- fail the EXISTS join the same way. Nothing more to do there.
