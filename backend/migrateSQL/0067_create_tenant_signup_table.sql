-- Migration: 0067
-- Public hospital signup intents. Paid signups are not provisioned until
-- the corresponding Razorpay payment is verified server-side.

CREATE TABLE tenant_signup (
  signup_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL,
  tenant_id UUID,
  hospital_name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL,
  admin_name VARCHAR(255) NOT NULL,
  admin_email VARCHAR(255) NOT NULL,
  password_hash TEXT NOT NULL,
  billing_period VARCHAR(20) NOT NULL DEFAULT 'monthly',
  amount_paise INTEGER NOT NULL DEFAULT 0,
  currency VARCHAR(10) NOT NULL DEFAULT 'INR',
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  razorpay_order_id VARCHAR(255) UNIQUE,
  razorpay_payment_id VARCHAR(255) UNIQUE,
  payment_signature VARCHAR(255),
  paid_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_tenant_signup_plan FOREIGN KEY (plan_id) REFERENCES plan(plan_id) ON DELETE RESTRICT,
  CONSTRAINT fk_tenant_signup_tenant FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id) ON DELETE SET NULL,
  CONSTRAINT chk_tenant_signup_amount CHECK (amount_paise >= 0),
  CONSTRAINT chk_tenant_signup_period CHECK (billing_period IN ('monthly', 'yearly')),
  CONSTRAINT chk_tenant_signup_status CHECK (status IN ('pending', 'paid', 'provisioned', 'failed', 'expired'))
);

CREATE INDEX idx_tenant_signup_slug_status ON tenant_signup (slug, status);
CREATE INDEX idx_tenant_signup_email_status ON tenant_signup (admin_email, status);
CREATE INDEX idx_tenant_signup_expires ON tenant_signup (expires_at) WHERE status = 'pending';
CREATE UNIQUE INDEX uq_tenant_signup_active_slug
  ON tenant_signup (slug)
  WHERE status IN ('pending', 'paid');
