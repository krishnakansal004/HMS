-- Migration: 0068
-- Durable SaaS subscription state for one-hospital tenants.

CREATE TABLE tenant_subscription (
  subscription_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  plan_id UUID NOT NULL,
  razorpay_subscription_id VARCHAR(255),
  billing_period VARCHAR(20) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_tenant_subscription_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id) ON DELETE CASCADE,
  CONSTRAINT fk_tenant_subscription_plan
    FOREIGN KEY (plan_id) REFERENCES plan(plan_id) ON DELETE RESTRICT,
  CONSTRAINT chk_tenant_subscription_period
    CHECK (billing_period IN ('monthly', 'yearly')),
  CONSTRAINT chk_tenant_subscription_status
    CHECK (status IN ('pending', 'active', 'paused', 'cancelled', 'expired', 'grace')),
  CONSTRAINT chk_tenant_subscription_period_order
    CHECK (current_period_end IS NULL OR current_period_start IS NULL OR current_period_end > current_period_start)
);

CREATE UNIQUE INDEX uq_tenant_subscription_razorpay_id
  ON tenant_subscription (razorpay_subscription_id)
  WHERE razorpay_subscription_id IS NOT NULL;

CREATE INDEX idx_tenant_subscription_tenant_status
  ON tenant_subscription (tenant_id, status);

CREATE INDEX idx_tenant_subscription_period_end
  ON tenant_subscription (current_period_end)
  WHERE status IN ('active', 'grace');

CREATE TRIGGER trg_tenant_subscription_updated_at
  BEFORE UPDATE ON tenant_subscription
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE tenant_subscription ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_subscription FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_tenant_subscription ON tenant_subscription
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
