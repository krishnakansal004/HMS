-- Create Invoice Table

CREATE TABLE invoice (
    invoice_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number INT NOT NULL,

    patient_id UUID NOT NULL,
    tenant_id UUID NOT NULL,

    subtotal NUMERIC(10,2) NOT NULL,
    gst_total NUMERIC(10,2) NOT NULL,
    total NUMERIC(10,2) NOT NULL,

    status VARCHAR(50) NOT NULL,
    paid BOOLEAN NOT NULL DEFAULT FALSE,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,

    CONSTRAINT fk_invoice_patient
        FOREIGN KEY (patient_id)
        REFERENCES patient (patient_id),

    CONSTRAINT fk_invoice_tenant
        FOREIGN KEY (tenant_id)
        REFERENCES tenant (tenant_id)
);