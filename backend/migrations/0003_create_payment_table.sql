-- Create Payment Table

CREATE TABLE payment (
    payment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL,
    tenant_id UUID NOT NULL,

    total NUMERIC(10,2) NOT NULL,
    razorpay_link_id VARCHAR(255),
    status VARCHAR(50) NOT NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,

    CONSTRAINT fk_payment_patient
        FOREIGN KEY (patient_id)
        REFERENCES patient (patient_id),

    CONSTRAINT fk_payment_tenant
        FOREIGN KEY (tenant_id)
        REFERENCES tenant (tenant_id)
);