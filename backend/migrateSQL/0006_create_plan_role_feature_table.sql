-- Migration: 0006
-- Table: plan_role_feature
-- Purpose: Plan-level permission overrides per role (e.g. subadmin feature grants tied to a plan).
-- Depends on: plan, role, permission

CREATE TABLE plan_role_feature (
    plan_id        UUID NOT NULL,
    role_id        UUID NOT NULL,
    permission_id  UUID NOT NULL,
    PRIMARY KEY (plan_id, role_id, permission_id),
    CONSTRAINT fk_prf_plan       FOREIGN KEY (plan_id) REFERENCES plan(plan_id) ON DELETE CASCADE,
    CONSTRAINT fk_prf_role       FOREIGN KEY (role_id) REFERENCES role(role_id) ON DELETE CASCADE,
    CONSTRAINT fk_prf_permission FOREIGN KEY (permission_id) REFERENCES permission(permission_id) ON DELETE CASCADE
);
