-- Migration: 0066
-- Patient voice notes are tenant-scoped and role-filtered clinical media.

CREATE TABLE voice_note (
  voice_note_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  patient_id UUID NOT NULL,
  recorded_by UUID NOT NULL,
  storage_url TEXT NOT NULL,
  public_id TEXT,
  mime_type VARCHAR(100) NOT NULL,
  size_bytes INT NOT NULL,
  duration_seconds INT,
  visible_to_roles VARCHAR(50)[] NOT NULL DEFAULT ARRAY['DOCTOR', 'NURSE', 'HOSPITAL_ADMIN']::VARCHAR(50)[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_voice_note_tenant FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id) ON DELETE CASCADE,
  CONSTRAINT fk_voice_note_patient FOREIGN KEY (tenant_id, patient_id) REFERENCES patient(tenant_id, patient_id) ON DELETE CASCADE,
  CONSTRAINT fk_voice_note_recorder FOREIGN KEY (tenant_id, recorded_by) REFERENCES users(tenant_id, user_id) ON DELETE RESTRICT,
  CONSTRAINT chk_voice_note_size CHECK (size_bytes > 0 AND size_bytes <= 10485760),
  CONSTRAINT chk_voice_note_duration CHECK (duration_seconds IS NULL OR (duration_seconds >= 1 AND duration_seconds <= 600))
);

CREATE INDEX idx_voice_note_tenant_patient_created
  ON voice_note (tenant_id, patient_id, created_at DESC);

ALTER TABLE voice_note ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_note FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_voice_note ON voice_note
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
