-- Create Expense Table

CREATE TABLE expense (
    expense_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    title VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    amount NUMERIC(10,2) NOT NULL,
    expense_date DATE NOT NULL,
    created_by UUID NOT NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,

    CONSTRAINT fk_expense_tenant
    FOREIGN KEY (tenant_id)
    REFERENCES tenant (tenant_id),

    CONSTRAINT fk_expense_created_by
        FOREIGN KEY (created_by)
        REFERENCES user (user_id)
);