-- Migration: 0024
-- Table: insurance_company
-- Depends on: tenant
-- NOTE: tenant_id added here (was missing in the earlier draft, inconsistent
-- with every other table in this domain). Decision made: each hospital
-- manages its own insurance/TPA relationships, so this is tenant-scoped. If
-- insurance companies should instead be a shared platform-wide catalog, drop
-- tenant_id and the associated unique constraint before merging.

CREATE TABLE insurance_company (
    company_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL,
    name                VARCHAR(255) NOT NULL,
    code                VARCHAR(50) NOT NULL,
    contact_person      VARCHAR(255),
    email               VARCHAR(255),
    phone               VARCHAR(20),
    corporate_discount  NUMERIC(5,2) NOT NULL DEFAULT 0,
    status              VARCHAR(50) NOT NULL DEFAULT 'active',
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at          TIMESTAMP NULL,
    CONSTRAINT fk_insurance_company_tenant FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id) ON DELETE CASCADE,
    CONSTRAINT uq_insurance_company_tenant_code UNIQUE (tenant_id, code),
    CONSTRAINT chk_insurance_company_discount CHECK (corporate_discount >= 0),
    CONSTRAINT chk_insurance_company_status CHECK (status IN ('active', 'inactive'))
);

CREATE INDEX idx_insurance_company_tenant ON insurance_company(tenant_id);
