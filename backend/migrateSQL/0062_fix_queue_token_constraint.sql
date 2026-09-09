-- Migration: 0062
-- Purpose: Enforce strict tenant isolation on queue tokens.

ALTER TABLE queue_token DROP CONSTRAINT IF EXISTS uq_queue_token_doctor_date_number;

CREATE UNIQUE INDEX uq_queue_token_tenant_doc_date_num 
  ON queue_token (tenant_id, doctor_id, token_date, token_number);