# HMS Production Readiness and Product Planning

**Review date:** 2026-09-15  
**Scope:** Backend, frontend, Prisma schema, SQL migrations, tests, deployment scripts, and the public product surface.  
**Conclusion:** The codebase has a solid multi-tenant foundation, but it is **not yet production-ready for real hospital/PHI workloads**. The main reason is not missing screens; it is release safety, payment/subscription correctness, privileged cross-tenant workflows, and protected clinical-media delivery.

This review covered the application source and tracked operational files. Dependencies, generated bundles, and historical uploaded media were not treated as application logic.

## Confirmed launch decisions

- **Tenant boundary:** one tenant equals one hospital. Parent organizations and multi-facility tenancy are deferred.
- **Billing:** recurring monthly/yearly Razorpay subscriptions. Refunds, late payments, and exceptional grace periods are handled manually for the MVP.
- **Compliance:** Indian launch focus is ABDM readiness and DPDP-aligned privacy, consent, retention, export, and deletion controls.
- **Role scope:** `SYSTEM_OWNER` is the only cross-hospital platform role. `DIRECTOR` is fully tenant-scoped and cannot bypass RLS.
- **Clinical visibility:** doctors may access assigned/care-team patients only, not every patient in their hospital.
- **Infrastructure:** Cloudinary for clinical media, PostgreSQL for relational data, Redis/BullMQ for queues, and separate Node.js API/worker processes.
- **MVP scope:** core clinical workflows, billing/subscriptions, pharmacy/inventory, and RLS/security. Telemedicine WebRTC, advanced HRMS approvals, and multi-facility analytics are post-launch.

## What is already strong

- PostgreSQL + Prisma with tenant-aware composite foreign keys across most clinical and financial tables.
- PostgreSQL RLS with `FORCE ROW LEVEL SECURITY` across the core tenant-scoped schema.
- JWT identity is checked against the database user and tenant before a request is accepted.
- Separate access/refresh secrets, short-lived access tokens, HTTP-only refresh cookies, login throttling, Helmet, CORS configuration, and centralized error handling.
- Broad domain coverage: patients, appointments, admissions, wards/beds, prescriptions, pharmacy/inventory, purchasing, invoices/payments, insurance, laboratory, radiology, HRMS, documents, analytics, plan administration, and patient voice notes.
- Paid public hospital signup now creates a Razorpay order and verifies the captured payment before provisioning a paid tenant.
- Current focused security tests pass: **13 tests in 3 suites**. The frontend production build passes, although it emits duplicate-key warnings in `frontend/src/components/ui/StatusPill.jsx`.

## Release blockers — fix before onboarding real hospitals

### P0. Make database deployment non-destructive

**Evidence:** `backend/runMigrations.js:20-22` drops and recreates the entire `public` schema. It also has no applied-migration ledger, does not wrap each migration in a transaction, and does not set a failing process exit code when migration execution fails. `backend/migrateSQL/README.md` is also stale and still describes the old migration count.

**Plan:** Replace this with a production migration workflow that records migration checksums, applies migrations once in numeric order, locks concurrent runners, stops on failure, and never contains `DROP SCHEMA public CASCADE`. Keep destructive reset behavior in a separately named development-only command that requires an explicit flag.

**Acceptance:** A release can run twice safely; a failed migration leaves a recoverable database; CI rejects destructive production migration scripts; backups and restore tests are documented.

### P0. Complete and test privileged System Owner workflows

The recent list endpoint fix correctly passes `SYSTEM_OWNER` into the cross-tenant repository. However, the plan-request review path still calls the tenant-scoped `db.plan_request` accessor without establishing a tenant context, while the route advertises both `SYSTEM_OWNER` and `DIRECTOR`. The same role/scope mismatch exists anywhere a cross-tenant route relies on normal tenant RLS instead of an explicit privileged path.

**Plan:** Define one explicit audited privileged access abstraction for `SYSTEM_OWNER` platform reads/writes. Remove `DIRECTOR` from all cross-tenant routes and ensure Director requests always enter their hospital tenant context.

**Acceptance:** Integration tests cover System Owner and Director list/read/update flows, including RLS-enabled production-like PostgreSQL, and every privileged action produces an audit record.

### P0. Protect voice notes and all clinical files at delivery time

`voice_note.storage_url` is returned directly to the browser after upload. The current Cloudinary delivery URL is not an application authorization boundary; anyone who obtains the URL may be able to play the audio outside the HMS session. Voice recordings can contain PHI.

**Plan:** Store only provider identifiers in the database where possible. Add an authenticated, tenant-scoped media endpoint that checks patient/role visibility and returns a short-lived signed URL or streams the object. Add retention, legal-hold, deletion, and failed-upload cleanup behavior. Apply the same review to documents, prescriptions, receipts, and radiology files.

**Acceptance:** A copied media URL cannot be replayed after expiry or from another tenant; access is logged; deletion is idempotent; orphaned provider objects are reconciled.

### P0. Make payment settlement server-authoritative

The paid signup flow is a good start, but patient invoice payment still accepts `amountPaid` from the browser and settles from the synchronous checkout callback. `PaymentService.verifyPaymentWebhook()` should fetch the Razorpay payment server-side, verify captured status, order, currency, and exact amount, and be idempotent on the gateway payment ID. Its initial invoice lookup occurs before tenant context is established, which can fail under forced RLS.

The subscription model also has no visible subscription period, renewal, grace-period, failed-payment, cancellation, refund, or entitlement snapshot. The launch decision is recurring monthly/yearly Razorpay billing with manually managed grace periods, so the MVP still needs a minimal subscription record and webhook-driven status even if automated proration and downgrades are deferred. A plan request can be approved by directly changing `tenant.plan_id`, so the upgrade-request flow must not become a way to grant paid features without a verified payment or an explicitly audited manual override.

**Plan:** Separate plan catalog, subscription, payment, refund, and entitlement state. Verify all payment facts from Razorpay, use a webhook as the durable source of truth, add idempotency keys/unique gateway IDs, and define upgrade/downgrade/proration/grace rules.

**Acceptance:** Replayed callbacks do not create duplicate payments; a manipulated amount is rejected; a successful payment cannot leave the tenant in an indeterminate plan state; payment and subscription reconciliation reports exist.

## High-priority correctness and security work

### Tenant isolation and authorization

- Keep RLS, composite foreign keys, and tenant-aware uniqueness as mandatory database controls. Add automated tests for every newly added table, including `voice_note` and `tenant_signup`.
- Do not rely on a caller-supplied tenant UUID for public lead/customization forms. Resolve the target tenant from a signed/validated hospital slug or intentionally store the lead as unassigned. The current query/contact path has a contract mismatch (`tenantId` versus `hospitalSlug`) and references `db` without importing it; the public form should be tested end-to-end.
- Replace hard-coded route role lists and the legacy lowercase permission helpers with one canonical permission model. Confirm whether plan limits/features are actually enforced on every create/invite endpoint.
- Enforce assigned/care-team patient access for doctors consistently across patients, appointments, admissions, prescriptions, invoices, laboratory, radiology, documents, and voice notes. This must be implemented in repositories/services and backed by cross-resource authorization tests, not only hidden in the frontend.
- Add object-level authorization tests for documents, invoices, prescriptions, patient files, voice notes, and administrative records, not only tenant-level checks.

### Signup and identity lifecycle

- `tenant_signup` stores a password hash and personal signup data before payment. Encrypt or minimize sensitive fields, purge expired/failed signups, and add a scheduled cleanup job.
- Add email verification for the hospital administrator, abuse controls beyond per-process IP rate limiting, and a durable distributed rate limiter for multi-instance deployment.
- Add refresh-token rotation and reuse detection. The current refresh flow blacklists on logout but intentionally does not rotate tokens.
- Add account lockout/risk controls, MFA for System Owner and hospital administrators, session/device visibility, and forced credential reset workflows.

### Audit, errors, and observability

- `AuditService.logAction()` is fire-and-forget. A database outage can silently lose evidence for clinical, financial, and security events. Queue audit events durably or await critical audit writes with an outbox/retry policy.
- Global/System Owner actions pass `tenantId: null` in places while `audit_log.tenant_id` is required; define a platform audit scope instead of silently failing these records.
- Add request IDs, structured security events, metrics, traces, alerting, and redaction rules. Do not log PHI, tokens, payment secrets, signed URLs, or raw request bodies.
- Split liveness from readiness. `/health` currently reports healthy without checking database, Redis, queue workers, storage, and payment configuration.
- Document the API/worker topology. Queue workers are started through imports and separate worker files; production needs explicit worker processes, concurrency limits, dead-letter handling, and job dashboards.

### Database and schema governance

- Prohibit `prisma db push` in production. The SQL migrations contain native RLS, checks, indexes, and triggers that Prisma schema synchronization can remove or drift from.
- Resolve the Prisma `SetNull` warnings on required relation fields instead of accepting ambiguous delete behavior.
- Add database checks for money/status fields consistently to every new table and add migration drift checks against the live schema.
- Add an explicit uniqueness/idempotency constraint for settled gateway transactions and confirm queue-token/invoice-number concurrency under load.
- Define backup frequency, point-in-time recovery, restore drills, retention, tenant export, tenant deletion, and disaster-recovery RPO/RTO.

## Product comparison and additions to plan

NuvertOS presents itself as a broad, modular hospital platform with OPD/IPD, patient lifecycle, e-prescription, billing, pharmacy, LIS, RIS, inventory, claims, reports, patient portal, role-based access, mobile access, ABDM/NABH readiness, integrations, and operational training/support. Its public module list also calls out queue management, MRD, approval dashboards, purchase/return/indent workflows, dialysis, and radiology/laboratory configuration.

Reference pages reviewed:

- [NuvertOS offerings/module list](https://nuvertos.com/home/product/list)
- [NuvertOS platform and role overview](https://connect.nuvertos.com/)

The current codebase covers a meaningful subset of that surface. The following should be planned as product work, after the release blockers:

1. **Clinical MVP:** assigned-patient access, registration → appointment → consultation → diagnostics → pharmacy → billing → discharge, queue support, nursing essentials, and Patient 360.
2. **Diagnostics:** specimen lifecycle, result validation/publishing, structured lab/radiology templates, barcode/QR support, PACS/DICOM and instrument interfaces as capacity allows.
3. **Finance MVP:** GST/e-invoicing requirements discovery, refunds, TPA settlement, cash handover, reconciliation, and recurring subscription billing with manual grace periods.
4. **Supply chain MVP:** purchase orders, GRN, expiry/batch controls, returns, department indents, stock transfers, and pharmacy reporting.
5. **ABDM/DPDP:** replace ABDM simulation with live integration boundaries, consent lifecycle, patient-facing consent records, data export/deletion workflows, retention policy, and privacy notices.
6. **Post-launch:** telemedicine WebRTC signaling, advanced HRMS leave approvals, multi-facility organizations/analytics, deeper interoperability, and broader mobile/PWA features.

These are product gaps or maturity opportunities, not reasons to rewrite the existing system. The order should be driven by the launch hospital’s workflows and compliance commitments.

## Proposed implementation order

### Phase 0 — Release gate

- Freeze destructive migration tooling and establish tracked migrations.
- Fix privileged plan-request review and public lead/contact submission.
- Protect media delivery and verify payment settlement server-side.
- Add production readiness checks for database, Redis, storage, Razorpay, and workers.
- Remove `DIRECTOR` from platform-level authorization and enforce tenant context on every Director route.
- Add assigned-patient authorization before enabling doctors for live hospital data.

### Phase 1 — Security and reliability baseline

- Canonical RBAC/permission matrix and object-level authorization tests.
- MFA/refresh-token lifecycle, distributed rate limiting, request IDs, audit outbox, and redacted structured logs.
- Backup/restore/DR runbook, queue monitoring, error alerting, and deployment rollback procedure.

### Phase 2 — Billing and SaaS lifecycle

- Minimal subscription/entitlement records with monthly/yearly periods, current period end, payment status, and a manually controlled grace-period flag.
- Razorpay subscription/webhook reconciliation, renewals, refunds, failed-payment handling, invoices, GST requirements, and platform finance reports.
- Keep proration and automated downgrade rules out of the MVP, but preserve enough state to add them safely later.

### Phase 3 — Hospital launch hardening

- End-to-end workflows for registration → appointment → consultation → diagnostics → pharmacy → billing → discharge.
- Load tests for concurrent appointments, queues, inventory, invoice numbers, and payment callbacks.
- Pilot with synthetic data, then a controlled hospital migration with PHI handling and support runbooks.

### Phase 4 — ABDM and DPDP launch readiness

- Replace simulated ABHA verification with the approved production integration and secrets/configuration model.
- Implement consent lifecycle, purpose limitation, access/export/deletion requests, retention enforcement, breach response, and privacy documentation.
- Run a compliance evidence review against the actual launch workflows before accepting live PHI.

### Phase 5 — Competitive expansion

- Queue/MRD/approvals, richer diagnostics, accounting/GST, patient engagement, interoperability, multi-facility, and mobile/PWA capabilities based on validated demand.

## Remaining decisions to confirm during implementation

The product and tenancy decisions above are now fixed. The remaining implementation-level inputs are the exact Razorpay subscription product/webhook event design, the assigned-patient relationship rule (doctor assignment only, care team, department, or appointment-based), the approved ABDM production integration credentials/partner, and the launch hospital's retention, support, backup, and recovery targets.
