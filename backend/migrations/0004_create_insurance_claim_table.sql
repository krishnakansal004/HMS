-- Create Insurance Claim Table

CREATE TABLE insurance_claim (
    claim_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL,
    company_id UUID NOT NULL,
    invoice_id UUID NOT NULL,

    policy_number VARCHAR(100) NOT NULL,
    total_bill_amount NUMERIC(10,2) NOT NULL,
    claimed_amount NUMERIC(10,2) NOT NULL,
    status VARCHAR(50) NOT NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,

    CONSTRAINT fk_insurance_claim_patient
        FOREIGN KEY (patient_id)
        REFERENCES patient (patient_id),

    CONSTRAINT fk_insurance_claim_company
        FOREIGN KEY (company_id)
        REFERENCES insurance_company (company_id),

    CONSTRAINT fk_insurance_claim_invoice
        FOREIGN KEY (invoice_id)
        REFERENCES invoice (invoice_id)
);