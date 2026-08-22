-- Migration: 0050
-- Tables: chat_model, chat_session, chat_message, document (all new)
-- Phase: 6 — AI Assistant & Document Storage
--
-- chat_model / chat_session / chat_message replace the legacy
-- routes/chat.js + routes/chatModels.js pair (OpenAI-backed support
-- chatbot with a per-role/per-tenant configurable system prompt). Scoped
-- down from the legacy version: no file-upload-into-chat (multer) support
-- yet -- that composes naturally with the `document` table below once a
-- storage backend is picked (see the note at the bottom), so it's left for
-- when that's wired up rather than duplicated here.
--
-- document is new, not a replacement for anything -- it's a direct answer
-- to the open item from your locked architecture decisions: "real
-- Cloudinary for invoices; other modules (patients, prescriptions,
-- radiology, payments, appointments, planRequests, planReceipts, lab)
-- still need an explicit storage backend pick." Every one of those modules
-- needing file attachments can point at this ONE table (entity_type +
-- entity_id) instead of each inventing its own file-metadata columns --
-- which is exactly the kind of per-module drift the last three audit
-- rounds kept finding. This table only stores metadata (URL, provider's
-- public_id, mime type, size); it doesn't change where files are actually
-- stored -- that's still the open decision.
--
-- Depends on: tenant (0004), users (0005)

CREATE TABLE chat_model (
    chat_model_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID,
    name            VARCHAR(150) NOT NULL,
    role            VARCHAR(50) NOT NULL,
    system_prompt    TEXT,
    keywords        JSONB DEFAULT '[]',
    created_by       UUID,
    created_at       TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_chat_model_tenant FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id) ON DELETE CASCADE,
    CONSTRAINT fk_chat_model_creator FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL
);

CREATE INDEX idx_chat_model_tenant ON chat_model(tenant_id);
CREATE INDEX idx_chat_model_role ON chat_model(role);

ALTER TABLE chat_model ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_model FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_chat_model ON chat_model
  USING (tenant_id = (current_setting('app.current_tenant_id', true))::uuid OR tenant_id IS NULL);

CREATE TRIGGER trg_chat_model_updated_at BEFORE UPDATE ON chat_model
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


CREATE TABLE chat_session (
    session_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     UUID,
    user_id       UUID,
    role          VARCHAR(50),
    started_at    TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    ended_at      TIMESTAMPTZ,
    CONSTRAINT fk_chat_session_tenant FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id) ON DELETE CASCADE,
    CONSTRAINT fk_chat_session_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL
);

CREATE INDEX idx_chat_session_tenant ON chat_session(tenant_id);
CREATE INDEX idx_chat_session_user ON chat_session(user_id);

ALTER TABLE chat_session ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_session FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_chat_session ON chat_session
  USING (tenant_id = (current_setting('app.current_tenant_id', true))::uuid OR tenant_id IS NULL);


CREATE TABLE chat_message (
    message_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id    UUID NOT NULL,
    sender        VARCHAR(20) NOT NULL,
    text          TEXT NOT NULL,
    created_at    TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_chat_message_session FOREIGN KEY (session_id) REFERENCES chat_session(session_id) ON DELETE CASCADE,
    CONSTRAINT chk_chat_message_sender CHECK (sender IN ('user', 'assistant', 'system'))
);

CREATE INDEX idx_chat_message_session ON chat_message(session_id, created_at);

-- chat_message has no tenant_id of its own (it belongs to a chat_session,
-- which does) so it can't carry its own tenant_isolation policy the same
-- way -- RLS is enforced one level up, at chat_session. A message row is
-- only reachable through a query that joins back to its session, and that
-- join is where the tenant boundary actually gets enforced. This mirrors
-- how invoice_item/purchase_item are scoped through their parent
-- invoice/purchase rather than carrying a redundant tenant_id of their own.

CREATE TABLE document (
  document_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL,
  entity_type      VARCHAR(50) NOT NULL,
  entity_id        UUID NOT NULL,
  uploaded_by      UUID,
  url             TEXT NOT NULL,
  public_id        TEXT,
  mime_type        VARCHAR(100),
  size_bytes       INT, 
  created_at       TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_document_tenant FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id) ON DELETE CASCADE,
  CONSTRAINT fk_document_uploader FOREIGN KEY (uploaded_by) REFERENCES users(user_id) ON DELETE SET NULL
);


ALTER TABLE chat_message ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_message FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_chat_message ON chat_message
  USING (EXISTS (
    SELECT 1 FROM chat_session 
    WHERE chat_session.session_id = chat_message.session_id 
    AND chat_session.tenant_id = (current_setting('app.current_tenant_id', true))::uuid
  ));

CREATE INDEX idx_document_tenant ON document(tenant_id);

CREATE INDEX idx_document_entity ON document(entity_type, entity_id);

ALTER TABLE document ENABLE ROW LEVEL SECURITY;
ALTER TABLE document FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_document ON document
  USING (tenant_id = (current_setting('app.current_tenant_id', true))::uuid);
