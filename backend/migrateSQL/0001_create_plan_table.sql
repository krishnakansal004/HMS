-- Migration: 0001
-- Table: plan
-- Purpose: Subscription plan catalog (pricing tiers, feature limits) for hospital tenants.
-- Depends on: none

CREATE TABLE plan (
    plan_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name         VARCHAR(255) NOT NULL,
    status       VARCHAR(50) NOT NULL DEFAULT 'active',
    public       BOOLEAN NOT NULL DEFAULT FALSE,
    customized   BOOLEAN NOT NULL DEFAULT FALSE,
    access_code  VARCHAR(100),
    durations    JSONB,
    prices       JSONB,
    limits       JSONB,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at   TIMESTAMP NULL,
    CONSTRAINT chk_plan_status CHECK (status IN ('active', 'inactive', 'archived'))
);

CREATE UNIQUE INDEX idx_plan_access_code ON plan(access_code) WHERE access_code IS NOT NULL;
