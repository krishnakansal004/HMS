# HMS PostgreSQL Migrations — dbMigrations/

Greenfield schema (no Firestore data import). 36 files, `0000`–`0035`, run **in
numeric order** — each one only depends on tables created in earlier files.

## Dependency order (why the numbering is what it is)

| Range | Domain | Notes |
|---|---|---|
| 0000 | Extension | `pgcrypto`, needed for `gen_random_uuid()` |
| 0001–0009 | Identity & Access | `plan` → `role`/`permission` → `tenant` → junctions → `users` → `setting` |
| 0010–0019 | People & Clinical Core | `ward` → `bed` → `patient` → (bed↔patient FK fix) → `doctor_profile` → attendance/availability → `appointment`/`prescription` |
| 0020–0034 | Billing, Pharmacy & Diagnostics | `supplier`/`medicine`/`purchase` chain, then `invoice` family, then `lab_test`/`lab_order`/`radiology_order` |
| 0035 | Security | Row-Level Security on every tenant-scoped table |

## The one circular reference: `bed` ↔ `patient`

`bed.patient_id` references `patient`, and `patient.bed_id` references `bed`.
Neither table can be created first with both FKs in place. Fix: `0011` creates
`bed` **without** the `fk_bed_patient` constraint, `0012` creates `patient`
(with its FK to `bed`, which already exists), then `0013` adds the missing
`fk_bed_patient` constraint via `ALTER TABLE` now that both tables exist.

## PK / ID strategy

Every primary key is `UUID PRIMARY KEY DEFAULT gen_random_uuid()`. This is a
greenfield build, so there's no `legacy_firestore_id` anywhere — no old IDs to
preserve.

## Table naming: `users`, not `user`

`user` is a reserved word in Postgres. Every table and FK reference uses
`users` (plural) consistently. One bug fixed from the earlier draft
(`expense.fk_expense_created_by`) referenced `user` instead of `users` — this
would have failed the migration outright.

## Snapshot fields — never update these after creation

Any column ending in `_snapshot` (`item_name_snapshot`, `unit_price_snapshot`,
`doctor_name_snapshot`, `patient_name_snapshot`, `test_name_snapshot`,
`unit_cost_snapshot`, `gst_rate_snapshot`) is a point-in-time copy. It exists so
historical records (an old invoice, an old appointment) don't silently change
if the source record (a medicine's price, a doctor's name) is edited later.
The matching FK (e.g. `medicine_id`) is for reporting/joins — it does not
replace the snapshot, and the snapshot should never be re-synced from the FK.

## Row-Level Security (0035)

Every tenant-scoped table gets `ENABLE ROW LEVEL SECURITY` + `FORCE ROW LEVEL
SECURITY` + a policy comparing `tenant_id` to `current_setting('app.current_tenant_id', true)`.
**Your backend's tenant middleware must run `SET LOCAL app.current_tenant_id = '<uuid>';`
inside a transaction at the start of every request** for this to work — without
it, queries simply return zero rows (fail-closed) rather than leaking data.

`tenant`, `plan`, `role`, `permission`, `role_permission`, and
`plan_role_feature` are NOT tenant-scoped (they're either the tenant root or a
shared, platform-wide catalog) and are correctly excluded from RLS.

## Bugs fixed from the earlier draft (all confirmed against the real app code)

- `invoice_number` — was effectively unenforced; now `UNIQUE(tenant_id, invoice_number)`.
- Missing `CHECK (... >= 0)` on every monetary column.
- Missing `CHECK (status IN (...))` on every status column.
- `patient_id UUID PRIMARY KEY gen_random_uuid()` — missing `DEFAULT`, a hard syntax error.
- `doctor_attendace` → `doctor_attendance` (typo).
- `approval_statues` → `approval_status` (typo).
- `REFERENCES user(user_id)` → `REFERENCES users(user_id)` (table doesn't exist as `user`).
- `insurance_claim` was missing `tenant_id` — added, needed for RLS without a join through `invoice`.
- `insurance_company` was missing `tenant_id` — added (see open decision below).
- `patient.user_id` was `NOT NULL` — changed to nullable (walk-in patients can exist without a portal login).
- `doctor_attendance.check_out_at` was `NOT NULL` — changed to nullable (can't require checkout at check-in time).
- `doctor_attendance` had redundant `status` + `is_present` — kept `status` only as single source of truth.
- `setting` had no `UNIQUE(tenant_id, key)` — added.
- `lab_order` didn't exist at all — added (catalog `lab_test` existed, but nothing linked a patient/doctor to an actual ordered test with results).
- `payment` renamed to `payment_request` — fields describe a payment link, not a settled transaction.
- Missing `created_at`/`updated_at`/`deleted_at` on Identity/Clinical tables — added everywhere for consistent soft-delete + audit trail.

## Open decisions — confirm with the team before your deadline, not after

1. **`insurance_company.tenant_id`** — added on the assumption each hospital manages its own insurance/TPA list. If it should be a shared platform-wide catalog instead, drop `tenant_id` and the `uq_insurance_company_tenant_code` constraint.
2. **`medicine.supplier_id`** — made nullable, treated as a "preferred supplier" rather than a hard link (actual sourcing is tracked per-restock in `purchase_item`). Confirm this matches intent.
3. **Enum values on every `CHECK (status IN (...))` constraint** — filled in with reasonable defaults based on the app's typical lifecycle for that entity, but not all were 100% confirmed against exact frontend strings. Do a quick pass against the frontend status labels before relying on these in production — a mismatched CHECK constraint will reject valid inserts.
4. **`invoice.plan_id`** — kept nullable on the same `invoice` table for both patient invoices and subscription invoices, rather than splitting into two tables. Revisit if this gets confusing in practice.

## 0036 — follow-up audit fixes

Added after a direct Q&A pass on the schema:
- FK-column indexes that were missing on junction tables and a handful of
  single-column FKs (`role_permission.permission_id`, `plan_role_feature.role_id`/
  `.permission_id`, `user_permission_override.permission_id`, `setting.updated_by`,
  `prescription_template.created_by`, `expense.created_by`,
  `payment_request.prescription_id`, `radiology_order.doctor_id`,
  `lab_order.doctor_id`/`.prescription_id`, `insurance_claim.invoice_id`).
- `CHECK` constraints that were missing on numeric columns:
  `insurance_claim.approved_amount >= 0` (nullable-safe), and a `0-100` bound
  on `medicine.gst_rate` / `invoice_item.gst_rate_snapshot`.

Kept as a separate file rather than editing 0000-0035, in case those were
already shared with the team.

## Tracked migration runner

Run migrations from `backend/` with:

```bash
node runMigrations.js
```

The runner creates `schema_migrations`, applies pending SQL files in lexical
order, records a SHA-256 checksum for every file, and fails if an applied file
is edited. It takes a PostgreSQL advisory lock and runs each migration in its
own transaction.

`--reset-dev` is an explicit development-only database reset and is rejected
unless `NODE_ENV=development`. Never use it against production.

For a pre-existing untracked database, verify its schema manually and perform
the one-time baseline with both flags below. Set the version to the last
migration that is already present; pending migrations after that version will
then be applied normally:

```bash
ALLOW_MIGRATION_BASELINE=true \
MIGRATION_BASELINE_VERSION=0067_tenant_signup.sql \
node runMigrations.js --baseline-existing
```

Do not baseline a database until the selected version has been verified. New
databases should use the normal command and should not be baselined.

## 0069 — staff payroll MVP

Adds tenant-scoped staff compensation profiles, payroll runs, and immutable
payroll item snapshots. Payroll uses the tenant `TIMEZONE` setting, excludes
doctors, pays approved leave, treats missing attendance as unpaid, and supports
manual additions/deductions plus manual payment marking.

## 0037 — ON DELETE consistency fix

Found while reviewing FK delete behavior: `appointment.patient_id`/`.doctor_id`
and `prescription.patient_id`/`.doctor_id` used `CASCADE`, meaning a hard-delete
of a patient or doctor would silently wipe their appointment/prescription
history. Every other clinical/financial table (`invoice`, `insurance_claim`,
`payment_request`, `lab_order`, `radiology_order`) correctly used `RESTRICT` on
`patient_id` for this exact reason — brought these two tables in line. Also
tightened `bed.ward_id` from `CASCADE` to `RESTRICT` — deleting a ward should
require explicitly emptying it first, not silently deleting its (possibly
occupied) beds.

**Rule of thumb going forward:** any FK from a table holding medical or
financial history back to `patient`/`doctor_profile` should be `RESTRICT`
(forces soft-delete via `deleted_at`, never a silent hard-delete cascade of
history). FKs to config/reference data (`plan`, `supplier`) can reasonably be
`SET NULL` or `RESTRICT` depending on whether the reference is optional.

## 0038 — partial indexes for soft-delete

Added `(tenant_id) WHERE deleted_at IS NULL` partial indexes on all 21 tables
that have both `tenant_id` and `deleted_at`. Most real queries filter for "this
tenant's active rows" — a partial index skips soft-deleted rows entirely,
staying smaller and faster than the full `idx_<table>_tenant` index already in
place (which still includes soft-deleted rows).

## 0039 — TIMESTAMPTZ + automatic updated_at trigger

Two infrastructure fixes, both applied via `information_schema` introspection
so they automatically cover every table rather than relying on a hardcoded
column list:

1. Every `TIMESTAMP` column is converted to `TIMESTAMPTZ`. Safe to do now since
   this is a greenfield DB with no data — `TIMESTAMPTZ` stores UTC internally
   and converts on display; plain `TIMESTAMP` has no timezone awareness at all,
   which is a common source of subtle bugs later. `DATE` columns
   (`expiry_date`, etc.) are left alone — a calendar date has no timezone
   component to get wrong.
2. A generic `set_updated_at()` trigger function, attached to every table with
   an `updated_at` column. Before this, `updated_at` only got set once via
   `DEFAULT` at `INSERT` time — nothing updated it afterwards, so it was
   meaningless as a "last modified" signal. Now it's guaranteed correct
   regardless of which service or code path performs the update.

## Running these migrations

Any Postgres migration runner that just applies numbered `.sql` files in order
will work (e.g. `node-pg-migrate`, `db-migrate`, or a simple custom runner
tracking applied filenames in a `schema_migrations` table). Whatever you use,
make sure it wraps each file in a transaction and stops on first failure —
don't let a partial migration silently continue past 0011/0013 (the bed/patient
split) or 0026/0027 (invoice/invoice_item).
### 0070 — Password reset session invalidation

Adds nullable `users.password_changed_at`. Password reset and account setup
set this timestamp; access and refresh authentication reject tokens issued
before it. Existing sessions remain valid during rollout because the column is
nullable.
