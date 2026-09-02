-- Migration: 0062
-- Purpose: Fixes the 500 crash during purchase order receiving.
-- The original constraint in 0022 missed 'completed' as a valid status,
-- causing Postgres to reject valid application state transitions.

ALTER TABLE purchase DROP CONSTRAINT IF EXISTS chk_purchase_status;

ALTER TABLE purchase ADD CONSTRAINT chk_purchase_status 
    CHECK (status IN ('pending', 'ordered', 'received', 'completed', 'cancelled'));