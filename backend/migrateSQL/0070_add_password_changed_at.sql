-- Password reset session invalidation metadata.
-- Nullable keeps existing refresh sessions valid during rollout; it is set on
-- every subsequent password setup/reset and checked against JWT iat.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ(6);
