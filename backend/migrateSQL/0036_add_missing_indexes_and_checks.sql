-- Migration: 0036
-- Purpose: Fixes found during a follow-up audit -- missing FK indexes and
-- missing CHECK constraints on numeric columns that were overlooked in the
-- initial pass. Added as a separate migration rather than editing 0000-0035,

-- Missing FK indexes ---------------------------------------------------

CREATE INDEX idx_role_permission_permission ON role_permission(permission_id);

CREATE INDEX idx_plan_role_feature_role ON plan_role_feature(role_id);
CREATE INDEX idx_plan_role_feature_permission ON plan_role_feature(permission_id);

CREATE INDEX idx_user_permission_override_permission ON user_permission_override(permission_id);

CREATE INDEX idx_setting_updated_by ON setting(updated_by);

CREATE INDEX idx_prescription_template_created_by ON prescription_template(created_by);

CREATE INDEX idx_expense_created_by ON expense(created_by);

CREATE INDEX idx_payment_request_prescription ON payment_request(prescription_id);

CREATE INDEX idx_radiology_order_doctor ON radiology_order(doctor_id);

CREATE INDEX idx_lab_order_doctor ON lab_order(doctor_id);
CREATE INDEX idx_lab_order_prescription ON lab_order(prescription_id);

CREATE INDEX idx_insurance_claim_invoice ON insurance_claim(invoice_id);

-- Missing CHECK constraints ---------------------------------------------

ALTER TABLE insurance_claim
    ADD CONSTRAINT chk_insurance_claim_approved_amount
    CHECK (approved_amount IS NULL OR approved_amount >= 0);

ALTER TABLE medicine
    ADD CONSTRAINT chk_medicine_gst_rate
    CHECK (gst_rate >= 0 AND gst_rate <= 100);

ALTER TABLE invoice_item
    ADD CONSTRAINT chk_invoice_item_gst_rate
    CHECK (gst_rate_snapshot >= 0 AND gst_rate_snapshot <= 100);
