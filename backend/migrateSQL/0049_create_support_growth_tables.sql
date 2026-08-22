-- Migration: 0049
-- Tables: query, customization_request (new), faq (new)
-- Phase: 5 — Support & Growth (marketing-site-facing, mostly pre-auth)
--
-- faq matches services/faqService.js's existing field names exactly (same
-- "written ahead of schema" situation as hrms/emergency).
--
-- query and customization_request are both fed by public, pre-auth forms
-- (the marketing site's contact form and "request a custom plan" modal --
-- see legacy routes/public.js and routes/queries.js /
-- routes/customizationRequests.js) and may or may not be tied to a specific
-- hospital tenant, so tenant_id is nullable on both, matching the legacy
-- behavior exactly (a general "contact us" message isn't about any one
-- hospital's data; a query submitted from inside a logged-in tenant context
-- is). 
-- 
-- ARCHITECTURAL PATCH APPLIED: Removed `OR tenant_id IS NULL` from query 
-- and customization_request RLS policies to prevent catastrophic cross-tenant 
-- PII leakage. It remains on faq to allow global support articles.
--
-- Depends on: tenant (0004), users (0005)

CREATE TABLE query (
    query_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id    UUID,
    name         VARCHAR(150) NOT NULL,
    email        VARCHAR(255) NOT NULL,
    phone        VARCHAR(20),
    message      TEXT NOT NULL,
    status       VARCHAR(20) NOT NULL DEFAULT 'NEW',
    created_at   TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_query_tenant FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id) ON DELETE CASCADE,
    CONSTRAINT chk_query_status CHECK (status IN ('NEW', 'PROCESSING', 'SOLVED', 'CLOSED'))
);

CREATE INDEX idx_query_tenant ON query(tenant_id);
CREATE INDEX idx_query_status ON query(status);

ALTER TABLE query ENABLE ROW LEVEL SECURITY;
ALTER TABLE query FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_query ON query
  USING (tenant_id = (current_setting('app.current_tenant_id', true))::uuid);

CREATE TRIGGER trg_query_updated_at BEFORE UPDATE ON query
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


CREATE TABLE customization_request (
    request_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id             UUID,
    title                 VARCHAR(255) NOT NULL,
    description            TEXT,
    requester_name          VARCHAR(150),
    requester_email         VARCHAR(255),
    requester_phone         VARCHAR(20),
    requester_address       TEXT,
    company                VARCHAR(200),
    purpose               TEXT,
    price_range            VARCHAR(50),
    period                VARCHAR(30),
    acceptance_text          TEXT,
    agreed                BOOLEAN DEFAULT FALSE,
    status                VARCHAR(20) NOT NULL DEFAULT 'NEW',
    created_by             UUID,
    created_at             TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at             TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_customization_request_tenant FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id) ON DELETE CASCADE,
    CONSTRAINT fk_customization_request_creator FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL,
    CONSTRAINT chk_customization_request_status CHECK (status IN ('NEW', 'IN_PROGRESS', 'COMPLETED', 'REJECTED'))
);

CREATE INDEX idx_customization_request_tenant ON customization_request(tenant_id);
CREATE INDEX idx_customization_request_status ON customization_request(status);

ALTER TABLE customization_request ENABLE ROW LEVEL SECURITY;
ALTER TABLE customization_request FORCE ROW LEVEL SECURITY;

-- PATCHED: Strict isolation. Unassigned customization requests will not leak to logged-in tenants.
CREATE POLICY tenant_isolation_customization_request ON customization_request
  USING (tenant_id = (current_setting('app.current_tenant_id', true))::uuid);

CREATE TRIGGER trg_customization_request_updated_at BEFORE UPDATE ON customization_request
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


CREATE TABLE faq (
    faq_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id    UUID,
    question     TEXT NOT NULL,
    answer       TEXT NOT NULL,
    category     VARCHAR(50) NOT NULL DEFAULT 'GENERAL',
    created_by   UUID,
    created_at   TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_faq_tenant FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id) ON DELETE CASCADE,
    CONSTRAINT fk_faq_creator FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL
);

CREATE INDEX idx_faq_tenant ON faq(tenant_id);
CREATE INDEX idx_faq_category ON faq(category);

ALTER TABLE faq ENABLE ROW LEVEL SECURITY;
ALTER TABLE faq FORCE ROW LEVEL SECURITY;

-- UNCHANGED: Global FAQs (tenant_id IS NULL) should remain visible to all tenants.
CREATE POLICY tenant_isolation_faq ON faq
  USING (tenant_id = (current_setting('app.current_tenant_id', true))::uuid OR tenant_id IS NULL);

CREATE TRIGGER trg_faq_updated_at BEFORE UPDATE ON faq
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();