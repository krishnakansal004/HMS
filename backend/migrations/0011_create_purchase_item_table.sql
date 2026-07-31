-- Create purchase item table.

CREATE TABLE purchase_item (
    purchase_item_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_id UUID NOT NULL,
    medicine_id UUID NOT NULL,
    quantity INT NOT NULL,
    unit_cost_snapshot NUMERIC(10,2) NOT NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,

    CONSTRAINT fk_purchase_item_purchase
        FOREIGN KEY (purchase_id)
        REFERENCES purchase (purchase_id),

    CONSTRAINT fk_purchase_item_medicine
        FOREIGN KEY (medicine_id)
        REFERENCES medicine (medicine_id)
);