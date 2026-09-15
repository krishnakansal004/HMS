-- Migration: 0069
-- Tenant-scoped salary profiles and auditable payroll runs for non-doctor staff.

CREATE TABLE staff_compensation (
  compensation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  user_id UUID NOT NULL,
  monthly_gross_paise BIGINT NOT NULL,
  employment_start_date DATE NOT NULL,
  employment_end_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_staff_compensation_tenant FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id) ON DELETE CASCADE,
  CONSTRAINT fk_staff_compensation_user FOREIGN KEY (tenant_id, user_id) REFERENCES users(tenant_id, user_id) ON DELETE CASCADE,
  CONSTRAINT uq_staff_compensation_user UNIQUE (tenant_id, user_id),
  CONSTRAINT chk_staff_compensation_salary CHECK (monthly_gross_paise > 0),
  CONSTRAINT chk_staff_compensation_dates CHECK (employment_end_date IS NULL OR employment_end_date >= employment_start_date)
);

CREATE INDEX idx_staff_compensation_tenant ON staff_compensation(tenant_id);
CREATE INDEX idx_staff_compensation_active_dates ON staff_compensation(tenant_id, employment_start_date, employment_end_date);

CREATE TABLE payroll_run (
  payroll_run_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  timezone VARCHAR(100) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
  created_by UUID NOT NULL,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_payroll_run_tenant FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id) ON DELETE CASCADE,
  CONSTRAINT fk_payroll_run_creator FOREIGN KEY (tenant_id, created_by) REFERENCES users(tenant_id, user_id) ON DELETE RESTRICT,
  CONSTRAINT fk_payroll_run_approver FOREIGN KEY (tenant_id, approved_by) REFERENCES users(tenant_id, user_id) ON DELETE RESTRICT,
  CONSTRAINT uq_payroll_run_period UNIQUE (tenant_id, period_start, period_end),
  CONSTRAINT uq_payroll_run_tenant_id UNIQUE (tenant_id, payroll_run_id),
  CONSTRAINT chk_payroll_run_period CHECK (period_end >= period_start),
  CONSTRAINT chk_payroll_run_status CHECK (status IN ('DRAFT', 'FROZEN', 'PARTIALLY_PAID', 'PAID', 'VOID'))
);

CREATE INDEX idx_payroll_run_tenant_status ON payroll_run(tenant_id, status);
CREATE INDEX idx_payroll_run_tenant_period ON payroll_run(tenant_id, period_start, period_end);

CREATE TABLE payroll_item (
  payroll_item_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  payroll_run_id UUID NOT NULL,
  user_id UUID NOT NULL,
  employee_name_snapshot VARCHAR(255) NOT NULL,
  employee_email_snapshot VARCHAR(255) NOT NULL,
  role_name_snapshot VARCHAR(100) NOT NULL,
  monthly_gross_paise BIGINT NOT NULL,
  calendar_days INTEGER NOT NULL,
  active_days NUMERIC(8, 2) NOT NULL,
  present_days NUMERIC(8, 2) NOT NULL DEFAULT 0,
  half_days NUMERIC(8, 2) NOT NULL DEFAULT 0,
  approved_leave_days NUMERIC(8, 2) NOT NULL DEFAULT 0,
  paid_days NUMERIC(8, 2) NOT NULL DEFAULT 0,
  gross_payable_paise BIGINT NOT NULL,
  additions_paise BIGINT NOT NULL DEFAULT 0,
  deductions_paise BIGINT NOT NULL DEFAULT 0,
  net_pay_paise BIGINT NOT NULL,
  adjustment_note TEXT,
  payment_status VARCHAR(20) NOT NULL DEFAULT 'UNPAID',
  paid_at TIMESTAMPTZ,
  paid_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_payroll_item_tenant FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id) ON DELETE CASCADE,
  CONSTRAINT fk_payroll_item_run FOREIGN KEY (tenant_id, payroll_run_id) REFERENCES payroll_run(tenant_id, payroll_run_id) ON DELETE CASCADE,
  CONSTRAINT fk_payroll_item_user FOREIGN KEY (tenant_id, user_id) REFERENCES users(tenant_id, user_id) ON DELETE RESTRICT,
  CONSTRAINT fk_payroll_item_payer FOREIGN KEY (tenant_id, paid_by) REFERENCES users(tenant_id, user_id) ON DELETE RESTRICT,
  CONSTRAINT uq_payroll_item_user UNIQUE (tenant_id, payroll_run_id, user_id),
  CONSTRAINT chk_payroll_item_money CHECK (monthly_gross_paise > 0 AND gross_payable_paise >= 0 AND additions_paise >= 0 AND deductions_paise >= 0 AND net_pay_paise >= 0),
  CONSTRAINT chk_payroll_item_days CHECK (calendar_days > 0 AND active_days >= 0 AND paid_days >= 0 AND paid_days <= active_days),
  CONSTRAINT chk_payroll_item_payment_status CHECK (payment_status IN ('UNPAID', 'PAID'))
);

CREATE INDEX idx_payroll_item_tenant_run ON payroll_item(tenant_id, payroll_run_id);
CREATE INDEX idx_payroll_item_tenant_user ON payroll_item(tenant_id, user_id);

CREATE TRIGGER trg_staff_compensation_updated_at BEFORE UPDATE ON staff_compensation
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_payroll_run_updated_at BEFORE UPDATE ON payroll_run
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_payroll_item_updated_at BEFORE UPDATE ON payroll_item
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE staff_compensation ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_compensation FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_staff_compensation ON staff_compensation
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

ALTER TABLE payroll_run ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_run FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_payroll_run ON payroll_run
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

ALTER TABLE payroll_item ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_item FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_payroll_item ON payroll_item
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
