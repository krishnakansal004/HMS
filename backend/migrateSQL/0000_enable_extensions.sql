-- Migration: 0000
-- Purpose: Enable pgcrypto so gen_random_uuid() is available for all PKs below.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
