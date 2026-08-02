-- Migration: 0003
-- Table: permission
-- Purpose: Formal permission/feature-key catalog (replaces free-text feature strings).
-- Depends on: none

CREATE TABLE permission (
    permission_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key            VARCHAR(255) NOT NULL UNIQUE,
    label          VARCHAR(255),
    category       VARCHAR(100),
    created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at     TIMESTAMP NULL
);
