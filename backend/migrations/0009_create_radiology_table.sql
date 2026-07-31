-- Create Radiology Order Table

CREATE TABLE radiology_order (
    radiology_order_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    patient_id UUID NOT NULL,

    patient_name_snapshot VARCHAR(255) NOT NULL,
    modality VARCHAR(100) NOT NULL,
    study_type VARCHAR(255) NOT NULL,
    urgency VARCHAR(50) NOT NULL,
    price NUMERIC(10,2) NOT NULL,
    status VARCHAR(50) NOT NULL,
    billing_status VARCHAR(50) NOT NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,

    CONSTRAINT fk_radiology_order_tenant
        FOREIGN KEY (tenant_id)
        REFERENCES tenant (tenant_id),

    CONSTRAINT fk_radiology_order_patient
        FOREIGN KEY (patient_id)
        REFERENCES patient (patient_id)
);