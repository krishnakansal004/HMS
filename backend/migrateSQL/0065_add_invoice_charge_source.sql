-- Migration: 0065
-- Track the patient charge source represented by an invoice line.

ALTER TABLE invoice_item
  ADD COLUMN IF NOT EXISTS source_key VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_invoice_item_source_key
  ON invoice_item (tenant_id, source_key)
  WHERE source_key IS NOT NULL;