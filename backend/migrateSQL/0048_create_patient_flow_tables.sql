-- Migration: 0048
-- Tables: queue_token, telemedicine_session (both new)
-- Phase: 4 — Patient Flow & Telehealth
--
-- No existing Prisma-era service references these yet (unlike hrms/
-- emergency/faq), so these are designed fresh from the legacy
-- routes/queue.js and routes/telemedicine.js -- scoped down the same way
-- emergencyService.js scoped down blood bank/ambulance/OT:
--   - queue_token drops the in-token chat/messaging sub-feature
--     (token.messages[]) and the payment-gating-before-chat logic from the
--     legacy version. Token-level chat is a real feature but it's really a
--     small realtime messaging system riding along on a queue record, and
--     belongs with the chat/telemedicine work in migration 0050, not
--     duplicated here as embedded JSON. payment_required/payment_status
--     stay, since that's genuinely queue-state, not chat.
--   - telemedicine_session keeps call metadata (room, duration, notes) but
--     doesn't invent WebRTC signaling infrastructure -- roomId/signalToken
--     generation is application logic, not something the schema needs to
--     model beyond storing the values.
--
-- Depends on: tenant (0004), patient (existing), doctor_profile (existing),
-- appointment (existing)

CREATE TABLE queue_token (
    token_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id          UUID NOT NULL,
    doctor_id          UUID NOT NULL,
    patient_id         UUID,
    patient_name        VARCHAR(200) NOT NULL,
    appointment_id      UUID,
    token_number        INT NOT NULL,
    token_date          DATE NOT NULL,
    status             VARCHAR(20) NOT NULL DEFAULT 'WAITING',
    source             VARCHAR(30) DEFAULT 'DOCTOR_ISSUED',
    meeting_link         TEXT,
    payment_required     BOOLEAN DEFAULT FALSE,
    payment_status       VARCHAR(20),
    notes              TEXT,
    created_at          TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_queue_token_tenant FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id) ON DELETE CASCADE,
    CONSTRAINT fk_queue_token_doctor FOREIGN KEY (doctor_id) REFERENCES doctor_profile(doctor_profile_id) ON DELETE CASCADE,
    CONSTRAINT fk_queue_token_patient FOREIGN KEY (patient_id) REFERENCES patient(patient_id) ON DELETE SET NULL,
    CONSTRAINT fk_queue_token_appointment FOREIGN KEY (appointment_id) REFERENCES appointment(appointment_id) ON DELETE SET NULL,
    CONSTRAINT chk_queue_token_status CHECK (status IN ('WAITING', 'CALLED', 'COMPLETED', 'SKIPPED')),
    CONSTRAINT chk_queue_token_payment_status CHECK (payment_status IS NULL OR payment_status IN ('PENDING', 'PAID')),
    CONSTRAINT uq_queue_token_doctor_date_number UNIQUE (doctor_id, token_date, token_number)
);

CREATE INDEX idx_queue_token_tenant ON queue_token(tenant_id);
CREATE INDEX idx_queue_token_doctor_date ON queue_token(doctor_id, token_date);
CREATE INDEX idx_queue_token_patient ON queue_token(patient_id);

ALTER TABLE queue_token ENABLE ROW LEVEL SECURITY;
ALTER TABLE queue_token FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_queue_token ON queue_token
  USING (tenant_id = (current_setting('app.current_tenant_id', true))::uuid);

CREATE TRIGGER trg_queue_token_updated_at BEFORE UPDATE ON queue_token
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


CREATE TABLE telemedicine_session (
    session_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id              UUID NOT NULL,
    appointment_id          UUID NOT NULL,
    patient_id             UUID NOT NULL,
    doctor_id              UUID NOT NULL,
    room_id                VARCHAR(100) NOT NULL,
    signal_token             VARCHAR(100),
    status                 VARCHAR(20) NOT NULL DEFAULT 'INITIATED',
    doctor_notes             TEXT,
    call_duration_seconds     INT DEFAULT 0,
    completed_at             TIMESTAMPTZ,
    created_by               UUID,
    created_at               TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at               TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_telemedicine_session_tenant FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id) ON DELETE CASCADE,
    CONSTRAINT fk_telemedicine_session_appointment FOREIGN KEY (appointment_id) REFERENCES appointment(appointment_id) ON DELETE CASCADE,
    CONSTRAINT fk_telemedicine_session_patient FOREIGN KEY (patient_id) REFERENCES patient(patient_id) ON DELETE CASCADE,
    CONSTRAINT fk_telemedicine_session_doctor FOREIGN KEY (doctor_id) REFERENCES doctor_profile(doctor_profile_id) ON DELETE CASCADE,
    CONSTRAINT fk_telemedicine_session_creator FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL,
    CONSTRAINT chk_telemedicine_session_status CHECK (status IN ('INITIATED', 'ACTIVE', 'COMPLETED', 'MISSED')),
    CONSTRAINT uq_telemedicine_session_appointment UNIQUE (appointment_id)
);

CREATE INDEX idx_telemedicine_session_tenant ON telemedicine_session(tenant_id);
CREATE INDEX idx_telemedicine_session_patient ON telemedicine_session(patient_id);
CREATE INDEX idx_telemedicine_session_doctor ON telemedicine_session(doctor_id);

ALTER TABLE telemedicine_session ENABLE ROW LEVEL SECURITY;
ALTER TABLE telemedicine_session FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_telemedicine_session ON telemedicine_session
  USING (tenant_id = (current_setting('app.current_tenant_id', true))::uuid);

CREATE TRIGGER trg_telemedicine_session_updated_at BEFORE UPDATE ON telemedicine_session
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
