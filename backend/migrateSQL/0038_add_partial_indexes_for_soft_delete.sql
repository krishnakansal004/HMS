-- Migration: 0038
-- Purpose: Add partial indexes on (tenant_id) WHERE deleted_at IS NULL for
-- every table that supports soft-delete. Most real queries filter for "this
-- tenant's active rows" -- a partial index excludes soft-deleted rows
-- entirely, keeping the index smaller and faster than indexing everything,
-- and is more targeted than the plain idx_<table>_tenant index already in
-- place (which still includes soft-deleted rows).

CREATE INDEX idx_ward_tenant_active ON ward(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_bed_tenant_active ON bed(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_patient_tenant_active ON patient(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_doctor_profile_tenant_active ON doctor_profile(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_appointment_tenant_active ON appointment(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_prescription_tenant_active ON prescription(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_prescription_template_tenant_active ON prescription_template(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_supplier_tenant_active ON supplier(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_medicine_tenant_active ON medicine(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_purchase_tenant_active ON purchase(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_purchase_item_tenant_active ON purchase_item(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_insurance_company_tenant_active ON insurance_company(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_invoice_tenant_active ON invoice(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_invoice_item_tenant_active ON invoice_item(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_insurance_claim_tenant_active ON insurance_claim(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_payment_request_tenant_active ON payment_request(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_expense_tenant_active ON expense(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_lab_test_tenant_active ON lab_test(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_lab_order_tenant_active ON lab_order(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_radiology_order_tenant_active ON radiology_order(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_tenant_active ON users(tenant_id) WHERE deleted_at IS NULL;

-- NOTE: tenant itself is excluded -- it's the tenant root, not tenant-scoped,
-- so a plain partial index on its own primary key/deleted_at would add
-- little value over the existing idx_tenant_plan.
