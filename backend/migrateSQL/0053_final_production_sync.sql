-- DropForeignKey
ALTER TABLE "abdm_consent" DROP CONSTRAINT "fk_abdm_consent_creator";

-- DropForeignKey
ALTER TABLE "abdm_consent" DROP CONSTRAINT "fk_abdm_consent_patient";

-- DropForeignKey
ALTER TABLE "admission" DROP CONSTRAINT "admission_admitting_doctor_id_fkey";

-- DropForeignKey
ALTER TABLE "admission" DROP CONSTRAINT "admission_bed_id_fkey";

-- DropForeignKey
ALTER TABLE "admission" DROP CONSTRAINT "admission_patient_id_fkey";

-- DropForeignKey
ALTER TABLE "ambulance_dispatch" DROP CONSTRAINT "fk_ambulance_dispatch_creator";

-- DropForeignKey
ALTER TABLE "ambulance_dispatch" DROP CONSTRAINT "fk_ambulance_dispatch_patient";

-- DropForeignKey
ALTER TABLE "appointment" DROP CONSTRAINT "fk_appointment_doctor";

-- DropForeignKey
ALTER TABLE "appointment" DROP CONSTRAINT "fk_appointment_patient";

-- DropForeignKey
ALTER TABLE "attendance" DROP CONSTRAINT "fk_attendance_user";

-- DropForeignKey
ALTER TABLE "bed" DROP CONSTRAINT "fk_bed_patient";

-- DropForeignKey
ALTER TABLE "bed" DROP CONSTRAINT "fk_bed_ward";

-- DropForeignKey
ALTER TABLE "doctor_application" DROP CONSTRAINT "fk_doctor_application_reviewer";

-- DropForeignKey
ALTER TABLE "doctor_attendance" DROP CONSTRAINT "fk_doctor_attendance_doctor";

-- DropForeignKey
ALTER TABLE "doctor_availability" DROP CONSTRAINT "fk_doctor_availability_doctor";

-- DropForeignKey
ALTER TABLE "doctor_profile" DROP CONSTRAINT "fk_doctor_profile_user";

-- DropForeignKey
ALTER TABLE "document" DROP CONSTRAINT "fk_document_uploader";

-- DropForeignKey
ALTER TABLE "expense" DROP CONSTRAINT "fk_expense_created_by";

-- DropForeignKey
ALTER TABLE "insurance_claim" DROP CONSTRAINT "fk_insurance_claim_company";

-- DropForeignKey
ALTER TABLE "insurance_claim" DROP CONSTRAINT "fk_insurance_claim_invoice";

-- DropForeignKey
ALTER TABLE "insurance_claim" DROP CONSTRAINT "fk_insurance_claim_patient";

-- DropForeignKey
ALTER TABLE "invoice" DROP CONSTRAINT "fk_invoice_patient";

-- DropForeignKey
ALTER TABLE "invoice_item" DROP CONSTRAINT "fk_invoice_item_invoice";

-- DropForeignKey
ALTER TABLE "invoice_item" DROP CONSTRAINT "fk_invoice_item_medicine";

-- DropForeignKey
ALTER TABLE "lab_order" DROP CONSTRAINT "fk_lab_order_doctor";

-- DropForeignKey
ALTER TABLE "lab_order" DROP CONSTRAINT "fk_lab_order_patient";

-- DropForeignKey
ALTER TABLE "lab_order" DROP CONSTRAINT "fk_lab_order_prescription";

-- DropForeignKey
ALTER TABLE "lab_order" DROP CONSTRAINT "fk_lab_order_test";

-- DropForeignKey
ALTER TABLE "leave" DROP CONSTRAINT "fk_leave_reviewer";

-- DropForeignKey
ALTER TABLE "leave" DROP CONSTRAINT "fk_leave_user";

-- DropForeignKey
ALTER TABLE "medicine" DROP CONSTRAINT "fk_medicine_supplier";

-- DropForeignKey
ALTER TABLE "operation_theater" DROP CONSTRAINT "fk_operation_theater_creator";

-- DropForeignKey
ALTER TABLE "operation_theater" DROP CONSTRAINT "fk_operation_theater_doctor";

-- DropForeignKey
ALTER TABLE "operation_theater" DROP CONSTRAINT "fk_operation_theater_patient";

-- DropForeignKey
ALTER TABLE "patient" DROP CONSTRAINT "fk_patient_bed";

-- DropForeignKey
ALTER TABLE "patient" DROP CONSTRAINT "fk_patient_user";

-- DropForeignKey
ALTER TABLE "payment" DROP CONSTRAINT "payment_invoice_id_fkey";

-- DropForeignKey
ALTER TABLE "payment_request" DROP CONSTRAINT "fk_payment_request_patient";

-- DropForeignKey
ALTER TABLE "payment_request" DROP CONSTRAINT "fk_payment_request_prescription";

-- DropForeignKey
ALTER TABLE "plan_receipt" DROP CONSTRAINT "fk_plan_receipt_invoice";

-- DropForeignKey
ALTER TABLE "prescription" DROP CONSTRAINT "fk_prescription_doctor";

-- DropForeignKey
ALTER TABLE "prescription" DROP CONSTRAINT "fk_prescription_patient";

-- DropForeignKey
ALTER TABLE "prescription_template" DROP CONSTRAINT "fk_prescription_template_user";

-- DropForeignKey
ALTER TABLE "purchase" DROP CONSTRAINT "fk_purchase_supplier";

-- DropForeignKey
ALTER TABLE "purchase_item" DROP CONSTRAINT "fk_purchase_item_medicine";

-- DropForeignKey
ALTER TABLE "purchase_item" DROP CONSTRAINT "fk_purchase_item_purchase";

-- DropForeignKey
ALTER TABLE "queue_token" DROP CONSTRAINT "fk_queue_token_appointment";

-- DropForeignKey
ALTER TABLE "queue_token" DROP CONSTRAINT "fk_queue_token_doctor";

-- DropForeignKey
ALTER TABLE "queue_token" DROP CONSTRAINT "fk_queue_token_patient";

-- DropForeignKey
ALTER TABLE "radiology_order" DROP CONSTRAINT "fk_radiology_order_doctor";

-- DropForeignKey
ALTER TABLE "radiology_order" DROP CONSTRAINT "fk_radiology_order_patient";

-- DropForeignKey
ALTER TABLE "setting" DROP CONSTRAINT "fk_setting_user";

-- DropForeignKey
ALTER TABLE "shift" DROP CONSTRAINT "fk_shift_user";

-- DropForeignKey
ALTER TABLE "shift" DROP CONSTRAINT "fk_shift_ward";

-- DropForeignKey
ALTER TABLE "stock_movement" DROP CONSTRAINT "stock_movement_medicine_id_fkey";

-- DropForeignKey
ALTER TABLE "telemedicine_session" DROP CONSTRAINT "fk_telemedicine_session_appointment";

-- DropForeignKey
ALTER TABLE "telemedicine_session" DROP CONSTRAINT "fk_telemedicine_session_creator";

-- DropForeignKey
ALTER TABLE "telemedicine_session" DROP CONSTRAINT "fk_telemedicine_session_doctor";

-- DropForeignKey
ALTER TABLE "telemedicine_session" DROP CONSTRAINT "fk_telemedicine_session_patient";

-- DropIndex
DROP INDEX "uq_abdm_consent_ref";

-- DropIndex
DROP INDEX "uq_doctor_application_pending_email";

-- DropIndex
DROP INDEX "uq_doctor_availability_doctor";

-- DropIndex
DROP INDEX "uq_doctor_profile_user";

-- DropIndex
DROP INDEX "uq_telemedicine_session_appointment";

-- AlterTable
ALTER TABLE "abdm_consent" ALTER COLUMN "data_types" SET NOT NULL;

-- AlterTable
ALTER TABLE "chat_model" ALTER COLUMN "keywords" SET NOT NULL;

-- AlterTable
ALTER TABLE "operation_theater" ALTER COLUMN "ot_room_number" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "uq_abdm_consent_tenant_ref" ON "abdm_consent"("tenant_id", "consent_ref");

-- CreateIndex
CREATE INDEX "idx_admission_tenant_active" ON "admission"("tenant_id") WHERE (deleted_at IS NULL);

-- CreateIndex
CREATE UNIQUE INDEX "appointment_tenant_id_appointment_id_key" ON "appointment"("tenant_id", "appointment_id");

-- CreateIndex
CREATE UNIQUE INDEX "bed_tenant_id_bed_id_key" ON "bed"("tenant_id", "bed_id");

-- CreateIndex
CREATE UNIQUE INDEX "chat_session_session_id_key" ON "chat_session"("session_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_doctor_availability_tenant_doctor" ON "doctor_availability"("tenant_id", "doctor_id");

-- CreateIndex
CREATE UNIQUE INDEX "doctor_profile_tenant_id_doctor_profile_id_key" ON "doctor_profile"("tenant_id", "doctor_profile_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_doctor_profile_tenant_user" ON "doctor_profile"("tenant_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "insurance_company_tenant_id_company_id_key" ON "insurance_company"("tenant_id", "company_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_tenant_id_invoice_id_key" ON "invoice"("tenant_id", "invoice_id");

-- CreateIndex
CREATE UNIQUE INDEX "lab_test_tenant_id_test_id_key" ON "lab_test"("tenant_id", "test_id");

-- CreateIndex
CREATE UNIQUE INDEX "medicine_tenant_id_medicine_id_key" ON "medicine"("tenant_id", "medicine_id");

-- CreateIndex
CREATE INDEX "idx_operation_theater_tenant_active" ON "operation_theater"("tenant_id") WHERE (deleted_at IS NULL);

-- CreateIndex
CREATE UNIQUE INDEX "patient_tenant_id_patient_id_key" ON "patient"("tenant_id", "patient_id");

-- CreateIndex
CREATE UNIQUE INDEX "prescription_tenant_id_prescription_id_key" ON "prescription"("tenant_id", "prescription_id");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_tenant_id_purchase_id_key" ON "purchase"("tenant_id", "purchase_id");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_tenant_id_supplier_id_key" ON "supplier"("tenant_id", "supplier_id");

-- CreateIndex
CREATE INDEX "idx_telemedicine_session_tenant_active" ON "telemedicine_session"("tenant_id") WHERE (deleted_at IS NULL);

-- CreateIndex
CREATE UNIQUE INDEX "uq_telemedicine_session_tenant_appt" ON "telemedicine_session"("tenant_id", "appointment_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_tenant_id_user_id_key" ON "users"("tenant_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "ward_tenant_id_ward_id_key" ON "ward"("tenant_id", "ward_id");

-- AddForeignKey
ALTER TABLE "abdm_consent" ADD CONSTRAINT "fk_abdm_consent_patient" FOREIGN KEY ("tenant_id", "patient_id") REFERENCES "patient"("tenant_id", "patient_id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "abdm_consent" ADD CONSTRAINT "fk_abdm_consent_creator" FOREIGN KEY ("tenant_id", "created_by") REFERENCES "users"("tenant_id", "user_id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "admission" ADD CONSTRAINT "admission_tenant_id_patient_id_fkey" FOREIGN KEY ("tenant_id", "patient_id") REFERENCES "patient"("tenant_id", "patient_id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "admission" ADD CONSTRAINT "admission_tenant_id_bed_id_fkey" FOREIGN KEY ("tenant_id", "bed_id") REFERENCES "bed"("tenant_id", "bed_id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "admission" ADD CONSTRAINT "admission_tenant_id_admitting_doctor_id_fkey" FOREIGN KEY ("tenant_id", "admitting_doctor_id") REFERENCES "doctor_profile"("tenant_id", "doctor_profile_id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ambulance_dispatch" ADD CONSTRAINT "fk_ambulance_dispatch_patient" FOREIGN KEY ("tenant_id", "patient_id") REFERENCES "patient"("tenant_id", "patient_id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ambulance_dispatch" ADD CONSTRAINT "fk_ambulance_dispatch_creator" FOREIGN KEY ("tenant_id", "created_by") REFERENCES "users"("tenant_id", "user_id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "appointment" ADD CONSTRAINT "fk_appointment_doctor" FOREIGN KEY ("tenant_id", "doctor_id") REFERENCES "doctor_profile"("tenant_id", "doctor_profile_id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "appointment" ADD CONSTRAINT "fk_appointment_patient" FOREIGN KEY ("tenant_id", "patient_id") REFERENCES "patient"("tenant_id", "patient_id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "attendance" ADD CONSTRAINT "fk_attendance_user" FOREIGN KEY ("tenant_id", "user_id") REFERENCES "users"("tenant_id", "user_id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "bed" ADD CONSTRAINT "fk_bed_patient" FOREIGN KEY ("tenant_id", "patient_id") REFERENCES "patient"("tenant_id", "patient_id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "bed" ADD CONSTRAINT "fk_bed_ward" FOREIGN KEY ("tenant_id", "ward_id") REFERENCES "ward"("tenant_id", "ward_id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "doctor_application" ADD CONSTRAINT "fk_doctor_application_reviewer" FOREIGN KEY ("tenant_id", "reviewed_by") REFERENCES "users"("tenant_id", "user_id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "doctor_attendance" ADD CONSTRAINT "fk_doctor_attendance_doctor" FOREIGN KEY ("tenant_id", "doctor_id") REFERENCES "doctor_profile"("tenant_id", "doctor_profile_id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "doctor_availability" ADD CONSTRAINT "fk_doctor_availability_doctor" FOREIGN KEY ("tenant_id", "doctor_id") REFERENCES "doctor_profile"("tenant_id", "doctor_profile_id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "doctor_profile" ADD CONSTRAINT "fk_doctor_profile_user" FOREIGN KEY ("tenant_id", "user_id") REFERENCES "users"("tenant_id", "user_id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "document" ADD CONSTRAINT "fk_document_uploader" FOREIGN KEY ("tenant_id", "uploaded_by") REFERENCES "users"("tenant_id", "user_id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "expense" ADD CONSTRAINT "fk_expense_created_by" FOREIGN KEY ("tenant_id", "created_by") REFERENCES "users"("tenant_id", "user_id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "insurance_claim" ADD CONSTRAINT "fk_insurance_claim_company" FOREIGN KEY ("tenant_id", "company_id") REFERENCES "insurance_company"("tenant_id", "company_id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "insurance_claim" ADD CONSTRAINT "fk_insurance_claim_invoice" FOREIGN KEY ("tenant_id", "invoice_id") REFERENCES "invoice"("tenant_id", "invoice_id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "insurance_claim" ADD CONSTRAINT "fk_insurance_claim_patient" FOREIGN KEY ("tenant_id", "patient_id") REFERENCES "patient"("tenant_id", "patient_id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "invoice" ADD CONSTRAINT "fk_invoice_patient" FOREIGN KEY ("tenant_id", "patient_id") REFERENCES "patient"("tenant_id", "patient_id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "invoice_item" ADD CONSTRAINT "fk_invoice_item_invoice" FOREIGN KEY ("tenant_id", "invoice_id") REFERENCES "invoice"("tenant_id", "invoice_id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "invoice_item" ADD CONSTRAINT "fk_invoice_item_medicine" FOREIGN KEY ("tenant_id", "medicine_id") REFERENCES "medicine"("tenant_id", "medicine_id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "lab_order" ADD CONSTRAINT "fk_lab_order_doctor" FOREIGN KEY ("tenant_id", "doctor_id") REFERENCES "doctor_profile"("tenant_id", "doctor_profile_id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "lab_order" ADD CONSTRAINT "fk_lab_order_patient" FOREIGN KEY ("tenant_id", "patient_id") REFERENCES "patient"("tenant_id", "patient_id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "lab_order" ADD CONSTRAINT "fk_lab_order_prescription" FOREIGN KEY ("tenant_id", "prescription_id") REFERENCES "prescription"("tenant_id", "prescription_id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "lab_order" ADD CONSTRAINT "fk_lab_order_test" FOREIGN KEY ("tenant_id", "test_id") REFERENCES "lab_test"("tenant_id", "test_id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "leave" ADD CONSTRAINT "fk_leave_user" FOREIGN KEY ("tenant_id", "user_id") REFERENCES "users"("tenant_id", "user_id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "leave" ADD CONSTRAINT "fk_leave_reviewer" FOREIGN KEY ("tenant_id", "reviewed_by") REFERENCES "users"("tenant_id", "user_id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "medicine" ADD CONSTRAINT "fk_medicine_supplier" FOREIGN KEY ("tenant_id", "supplier_id") REFERENCES "supplier"("tenant_id", "supplier_id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "operation_theater" ADD CONSTRAINT "fk_operation_theater_patient" FOREIGN KEY ("tenant_id", "patient_id") REFERENCES "patient"("tenant_id", "patient_id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "operation_theater" ADD CONSTRAINT "fk_operation_theater_doctor" FOREIGN KEY ("tenant_id", "doctor_id") REFERENCES "doctor_profile"("tenant_id", "doctor_profile_id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "operation_theater" ADD CONSTRAINT "fk_operation_theater_creator" FOREIGN KEY ("tenant_id", "created_by") REFERENCES "users"("tenant_id", "user_id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "patient" ADD CONSTRAINT "fk_patient_bed" FOREIGN KEY ("tenant_id", "bed_id") REFERENCES "bed"("tenant_id", "bed_id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "patient" ADD CONSTRAINT "fk_patient_user" FOREIGN KEY ("tenant_id", "user_id") REFERENCES "users"("tenant_id", "user_id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "payment" ADD CONSTRAINT "payment_tenant_id_invoice_id_fkey" FOREIGN KEY ("tenant_id", "invoice_id") REFERENCES "invoice"("tenant_id", "invoice_id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "payment_request" ADD CONSTRAINT "fk_payment_request_patient" FOREIGN KEY ("tenant_id", "patient_id") REFERENCES "patient"("tenant_id", "patient_id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "payment_request" ADD CONSTRAINT "fk_payment_request_prescription" FOREIGN KEY ("tenant_id", "prescription_id") REFERENCES "prescription"("tenant_id", "prescription_id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "plan_receipt" ADD CONSTRAINT "fk_plan_receipt_invoice" FOREIGN KEY ("tenant_id", "invoice_id") REFERENCES "invoice"("tenant_id", "invoice_id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "prescription" ADD CONSTRAINT "fk_prescription_doctor" FOREIGN KEY ("tenant_id", "doctor_id") REFERENCES "doctor_profile"("tenant_id", "doctor_profile_id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "prescription" ADD CONSTRAINT "fk_prescription_patient" FOREIGN KEY ("tenant_id", "patient_id") REFERENCES "patient"("tenant_id", "patient_id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "prescription_template" ADD CONSTRAINT "fk_prescription_template_user" FOREIGN KEY ("tenant_id", "created_by") REFERENCES "users"("tenant_id", "user_id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "purchase" ADD CONSTRAINT "fk_purchase_supplier" FOREIGN KEY ("tenant_id", "supplier_id") REFERENCES "supplier"("tenant_id", "supplier_id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "purchase_item" ADD CONSTRAINT "fk_purchase_item_medicine" FOREIGN KEY ("tenant_id", "medicine_id") REFERENCES "medicine"("tenant_id", "medicine_id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "purchase_item" ADD CONSTRAINT "fk_purchase_item_purchase" FOREIGN KEY ("tenant_id", "purchase_id") REFERENCES "purchase"("tenant_id", "purchase_id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "queue_token" ADD CONSTRAINT "fk_queue_token_appointment" FOREIGN KEY ("tenant_id", "appointment_id") REFERENCES "appointment"("tenant_id", "appointment_id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "queue_token" ADD CONSTRAINT "fk_queue_token_doctor" FOREIGN KEY ("tenant_id", "doctor_id") REFERENCES "doctor_profile"("tenant_id", "doctor_profile_id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "queue_token" ADD CONSTRAINT "fk_queue_token_patient" FOREIGN KEY ("tenant_id", "patient_id") REFERENCES "patient"("tenant_id", "patient_id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "radiology_order" ADD CONSTRAINT "fk_radiology_order_doctor" FOREIGN KEY ("tenant_id", "doctor_id") REFERENCES "doctor_profile"("tenant_id", "doctor_profile_id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "radiology_order" ADD CONSTRAINT "fk_radiology_order_patient" FOREIGN KEY ("tenant_id", "patient_id") REFERENCES "patient"("tenant_id", "patient_id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "setting" ADD CONSTRAINT "fk_setting_user" FOREIGN KEY ("tenant_id", "updated_by") REFERENCES "users"("tenant_id", "user_id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "shift" ADD CONSTRAINT "fk_shift_user" FOREIGN KEY ("tenant_id", "user_id") REFERENCES "users"("tenant_id", "user_id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "shift" ADD CONSTRAINT "fk_shift_ward" FOREIGN KEY ("tenant_id", "ward_id") REFERENCES "ward"("tenant_id", "ward_id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "stock_movement" ADD CONSTRAINT "stock_movement_tenant_id_medicine_id_fkey" FOREIGN KEY ("tenant_id", "medicine_id") REFERENCES "medicine"("tenant_id", "medicine_id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "telemedicine_session" ADD CONSTRAINT "fk_telemedicine_session_appointment" FOREIGN KEY ("tenant_id", "appointment_id") REFERENCES "appointment"("tenant_id", "appointment_id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "telemedicine_session" ADD CONSTRAINT "fk_telemedicine_session_doctor" FOREIGN KEY ("tenant_id", "doctor_id") REFERENCES "doctor_profile"("tenant_id", "doctor_profile_id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "telemedicine_session" ADD CONSTRAINT "fk_telemedicine_session_patient" FOREIGN KEY ("tenant_id", "patient_id") REFERENCES "patient"("tenant_id", "patient_id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "telemedicine_session" ADD CONSTRAINT "fk_telemedicine_session_creator" FOREIGN KEY ("tenant_id", "created_by") REFERENCES "users"("tenant_id", "user_id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- ============================================================================
-- MANUAL SECURITY APPEND: RLS AND IMMUTABLE TRIGGERS
-- ============================================================================

-- 1. Enforce RLS on the child chat_message table via the parent session
ALTER TABLE chat_message ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_message FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_chat_message ON chat_message
  USING (EXISTS (
    SELECT 1 FROM chat_session 
    WHERE chat_session.session_id = chat_message.session_id 
    AND chat_session.tenant_id = (current_setting('app.current_tenant_id', true))::uuid
  ));

-- 2. Enforce Immutable Audit Logs (Reject UPDATE and DELETE)
CREATE OR REPLACE FUNCTION prevent_audit_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Audit logs are immutable and cannot be modified or deleted.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_immutable_audit
BEFORE UPDATE OR DELETE ON audit_log
FOR EACH ROW EXECUTE FUNCTION prevent_audit_modification();