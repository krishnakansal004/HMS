-- Migration: 0005
-- Table: role_permission
-- Purpose: Default permission grants per role (junction table).
-- Depends on: role, permission

CREATE TABLE role_permission (
    role_id        UUID NOT NULL,
    permission_id  UUID NOT NULL,
    PRIMARY KEY (role_id, permission_id),
    CONSTRAINT fk_rp_role       FOREIGN KEY (role_id) REFERENCES role(role_id) ON DELETE CASCADE,
    CONSTRAINT fk_rp_permission FOREIGN KEY (permission_id) REFERENCES permission(permission_id) ON DELETE CASCADE
);
