-- Migration: 0008
-- Table: user_permission_override
-- Purpose: Per-user permission grants/revokes on top of role + plan defaults.
-- Depends on: users, permission

CREATE TABLE user_permission_override (
    user_id        UUID NOT NULL,
    permission_id  UUID NOT NULL,
    granted        BOOLEAN NOT NULL,
    created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, permission_id),
    CONSTRAINT fk_upo_user       FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    CONSTRAINT fk_upo_permission FOREIGN KEY (permission_id) REFERENCES permission(permission_id) ON DELETE CASCADE
);
