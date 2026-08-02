-- Migration: 0025
-- Table: plan_request
-- Purpose: A tenant's request to subscribe to / upgrade a plan.
-- Depends on: tenant, plan

CREATE TABLE plan_request (
    plan_request_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id         UUID NOT NULL,
    plan_id           UUID NOT NULL,
    period            VARCHAR(50),
    requested_amount  NUMERIC(10,2),
    access_code       VARCHAR(100),
    status            VARCHAR(50) NOT NULL DEFAULT 'pending',
    created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_plan_request_tenant FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id) ON DELETE CASCADE,
    CONSTRAINT fk_plan_request_plan   FOREIGN KEY (plan_id) REFERENCES plan(plan_id) ON DELETE RESTRICT,
    CONSTRAINT chk_plan_request_amount CHECK (requested_amount >= 0),
    CONSTRAINT chk_plan_request_status CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled'))
);

CREATE INDEX idx_plan_request_tenant ON plan_request(tenant_id);
