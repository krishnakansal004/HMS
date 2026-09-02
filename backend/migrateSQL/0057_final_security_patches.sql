-- Migration: 0057_final_security_patches.sql
-- Phase: Security Lockdown
-- Depends on: 0056

-- 1. Fix the Cross-Tenant Leak in Admissions
ALTER TABLE "admission" DROP CONSTRAINT IF EXISTS "admission_bed_id_fkey";
ALTER TABLE "admission" ADD CONSTRAINT "admission_tenant_bed_fkey" 
    FOREIGN KEY ("tenant_id", "bed_id") REFERENCES "bed"("tenant_id", "bed_id") ON DELETE SET NULL;

ALTER TABLE "admission" DROP CONSTRAINT IF EXISTS "admission_admitting_doctor_id_fkey";
ALTER TABLE "admission" ADD CONSTRAINT "admission_tenant_doctor_fkey" 
    FOREIGN KEY ("tenant_id", "admitting_doctor_id") REFERENCES "doctor_profile"("tenant_id", "doctor_profile_id") ON DELETE SET NULL;

-- 2. Enforce ABHA ID Tenant Uniqueness
CREATE UNIQUE INDEX "uq_patient_tenant_abha" ON "patient"("tenant_id", "abha_id") WHERE "abha_id" IS NOT NULL;