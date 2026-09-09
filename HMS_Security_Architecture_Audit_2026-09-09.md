# Principal Security & Architecture Audit — HMS_MAIN

**Audit date:** 2026-09-09  
**Scope:** `HMS-Main/` repository  
**Method:** Read-only repository inspection, targeted static tracing, and existing test-command execution  
**Code changes:** None

# Executive Summary

The repository has a strong intended architecture: PostgreSQL, Prisma, forced Row-Level Security, tenant-aware composite foreign keys, JWT authentication, HTTP-only refresh cookies, centralized error handling, and broad route-level RBAC.

It is **not production-ready for a healthcare multi-tenant SaaS deployment** because several confirmed authorization and operational integrity issues remain:

- Hospital doctors can delete documents uploaded by other users in the same tenant.
- Hospital administrators/directors can delete any FAQ, including another tenant's or global FAQ.
- Payment verification does not cryptographically bind the payment signature to the supplied invoice and amount.
- System Owner workflows do not consistently establish tenant/RLS context.
- The PDF queue imports a Firebase implementation under a Cloudinary name and calls an undefined `admin` object.
- The migration runner drops the entire production schema before applying migrations.
- Legacy Firestore/Mongoose code and dependencies remain.
- Existing backend tests are not registered correctly with Jest and fail before providing reliable coverage.

The database RLS design is materially better than ordinary application-only tenant filtering, but RLS cannot compensate for object-level authorization errors, incorrect System Owner context handling, or unsafe operational scripts.

# Critical Security Vulnerabilities

No confirmed Critical vulnerability was established from static repository evidence. The destructive migration runner is classified as High because it requires explicit operator execution, but its behavior can cause catastrophic data loss.

## [HIGH] Cross-User Document Deletion Within a Tenant

**Status:** CONFIRMED  
**Confidence:** HIGH  
**Location:** `backend/src/services/documentService.js:64-89`; `backend/src/routes/documents.js:26-31`

### Evidence

`DELETE /api/documents/:id` permits `HOSPITAL_ADMIN` and `DOCTOR`.

`DocumentService.deleteDocument()` verifies only the document ID and tenant ID. It never compares `existing.uploaded_by` with `userId`.

`DocumentRepository.deleteByIdAndTenant()` deletes by document ID and tenant only.

### Impact

Any doctor can delete another doctor's, nurse's, or administrator's document within the same tenant. Documents may represent patient uploads, invoices, prescriptions, lab reports, or radiology records.

### Attack / Failure Scenario

A doctor obtains or guesses a document UUID and sends:

```http
DELETE /api/documents/{other-users-document-id}
Authorization: Bearer doctor-token
```

The request succeeds if the document belongs to the same tenant.

### Recommended Remediation

Require object-level authorization. Hospital administrators may delete according to documented policy; doctors should delete only documents they uploaded or documents explicitly assigned to their care relationship. Prefer soft deletion and immutable audit records for clinical documents.

## [HIGH] FAQ Deletion Is Not Tenant-Scoped

**Status:** CONFIRMED  
**Confidence:** HIGH  
**Location:** `backend/src/services/faqService.js:52-61`; `backend/src/routes/faqs.js:20-31`

### Evidence

The delete route permits `HOSPITAL_ADMIN` and `DIRECTOR`.

`FaqService.deleteFaq()` performs `findUnique` and `delete` using only `faq_id`. Neither operation verifies `tenant_id`. The route also does not apply `requireTenant`.

### Impact

A hospital administrator or director can delete another tenant's FAQ or a global FAQ with `tenant_id IS NULL`.

### Attack / Failure Scenario

A user submits a valid FAQ UUID from another tenant to `DELETE /api/faqs/{faq-id}`. The role check passes and the service deletes the record.

### Recommended Remediation

For hospital users, require matching `tenant_id`. Permit global FAQ deletion only to `SYSTEM_OWNER`. Add explicit ownership rules for tenant FAQ management.

## [HIGH] Payment Verification Is Not Bound to the Invoice

**Status:** POTENTIAL  
**Confidence:** HIGH  
**Location:** `backend/src/routes/payments.js:28-33`; `backend/src/services/paymentService.js:47-113`

### Evidence

The public endpoint accepts `invoiceId`, `gatewayPaymentId`, `razorpayOrderId`, `amountPaid`, and `signature`.

The HMAC covers only `razorpayOrderId + '|' + gatewayPaymentId`. It does not cover `invoiceId` or `amountPaid`.

The service fetches the invoice from the caller-supplied `invoiceId`, but no stored server-side association between that invoice and the Razorpay order is verified.

### Impact

If an attacker obtains a valid Razorpay signature, they may be able to reuse it with a different invoice ID or manipulated amount if RLS is absent, misconfigured, or bypassed. This can create false payment records and mark unpaid invoices as settled.

The initial invoice lookup also occurs before `tenantStorage.run()`, so forced RLS may return no invoice for a valid public callback.

### Recommended Remediation

Persist the Razorpay order ID against the invoice during initiation. Verify order-to-invoice ownership, fetch payment amount and status server-side, reject client-supplied settlement amounts, enforce unique gateway payment IDs, and add replay/duplicate-payment tests.

## [HIGH] Destructive Migration Runner Can Drop the Entire Database

**Status:** CONFIRMED  
**Confidence:** HIGH  
**Location:** `backend/runMigrations.js:18-25`

### Evidence

The script executes:

```sql
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
```

before running every SQL file.

### Impact

Running this script against production destroys all application tables, records, audit logs, credentials, and clinical data. A later migration failure leaves the database empty or partially rebuilt.

### Recommended Remediation

Remove destructive reset behavior from production migration tooling. Use versioned migrations, require an explicit development-only reset flag, add CI checks against destructive statements, and require backups plus restore verification before production migrations.

## [HIGH] PDF Worker Uses an Undefined Storage Implementation

**Status:** CONFIRMED  
**Confidence:** HIGH  
**Location:** `backend/src/queues/pdfQueue.js:4-5`; `backend/src/config/cloudinary.js:10-35`

### Evidence

The PDF worker imports `uploadToCloudinary()`.

The implementation is actually Firebase Storage code and calls `admin.storage().bucket()`. `admin` is not imported or defined in `cloudinary.js`.

### Impact

Paid invoice PDF generation can fail after payment processing. The payment may be recorded while receipt upload fails and the queue retries the job.

### Recommended Remediation

Choose one storage provider and implement it consistently. Initialize and validate the provider explicitly, scope object paths by tenant, use bounded signed URL expiration, and test the complete payment-to-PDF workflow.

# RLS & Multi-Tenancy Leaks

## Tenant Context Flow

The intended flow is:

```text
JWT tenantId
  -> authMiddleware.protect()
  -> req.currentTenantId
  -> tenantMiddleware
  -> tenantStorage.run({ tenantId })
  -> db Proxy
  -> SET LOCAL app.current_tenant_id
  -> PostgreSQL RLS policy
```

Relevant locations:

- JWT verification and database identity binding: `backend/src/middlewares/authMiddleware.js:12-48`
- Tenant validation and AsyncLocalStorage: `backend/src/middlewares/tenantMiddleware.js:7-49`
- Prisma transaction wrapper: `backend/src/config/db.js:26-76`
- Forced RLS migration: `backend/migrateSQL/0035_enable_row_level_security.sql:20-42`

## Security Control Matrix

| Area | Status | Finding |
|---|---|---|
| Tenant context | PASS with conditions | JWT identity is checked against the database user tenant, but System Owner flows bypass normal context establishment. |
| Prisma isolation | PASS with conditions | Wrapped model calls set `app.current_tenant_id`; raw `prisma` remains exported and is used in provisioning/system paths. |
| System-owner bypass | FAIL | `tenantMiddleware` returns without `tenantStorage.run()` for `SYSTEM_OWNER`. |
| Frontend tenant IDs | PASS for clinical authorization | No confirmed frontend-controlled tenant authorization bypass was found for ordinary clinical routes. |
| Public tenant attribution | MEDIUM RISK | Public lead/customization forms accept caller-supplied tenant IDs. |
| Global resources | FAIL | FAQ deletion does not enforce global-versus-tenant ownership. |
| PostgreSQL RLS | PASS with conditions | RLS and `FORCE ROW LEVEL SECURITY` are present, but deployment consistency is not proven. |
| Object authorization | FAIL | Document and FAQ deletion lack ownership/tenant checks. |
| Tenant-aware foreign keys | MOSTLY PASS | Later migrations add composite tenant foreign keys; deployment ordering must be verified. |
| Tenant-aware uniqueness | PASS with gaps | Many constraints are composite; broader business validation still requires review. |

## [HIGH] System Owner RLS Context Trap

**Status:** CONFIRMED  
**Confidence:** HIGH  
**Location:** `backend/src/middlewares/tenantMiddleware.js:7-10`; `backend/src/middlewares/authMiddleware.js:20-34`; `backend/src/services/analyticsService.js:48-82`

### Evidence

`tenantMiddleware` bypasses context for `SYSTEM_OWNER`:

```js
if (req.userRole === "SYSTEM_OWNER") {
  return next();
}
```

The `protect` middleware sets tenant context only around the user lookup. That context does not automatically remain active for the rest of the request. Platform services then query RLS-protected tables such as `plan_request` and `plan_receipt` without tenant context.

### Impact

System Owner platform views can return zero rows or fail to write. This affects platform analytics, plan request listing/review, and subscription receipt operations.

### Recommended Remediation

Use an explicit, narrowly scoped System Owner execution mechanism. For cross-tenant reports, use a dedicated audited privileged database role or service path. Do not rely on absent tenant context as an implicit bypass. Add integration tests for System Owner routes.

## RLS Coverage

The migration series enables RLS on core tenant-scoped tables and later adds policies for admissions, attendance, HRMS, emergency resources, queue and telemedicine tables, queries, customization requests, chat sessions/messages, documents, ABDM consent, audit logs, permission overrides, payments, and stock movements.

Relevant migrations:

- `backend/migrateSQL/0035_enable_row_level_security.sql`
- `backend/migrateSQL/0055_fix_null_tenant_rls_leak.sql`
- `backend/migrateSQL/0056_fix_audit_log_and_permission_override_rls.sql`
- `backend/migrateSQL/0059_fix_query_insert_rls.sql`

The repository does not prove that every deployed database has executed every migration successfully. The destructive reset script and migration documentation drift increase that deployment risk.

## Client-Supplied Tenant IDs

Public query and customization forms accept tenant attribution from request data:

- `backend/src/controllers/queryController.js:5-18`
- `backend/src/repositories/queryRepository.js:5-15`
- `backend/src/repositories/customizationRequestRepository.js:5-28`

This was not classified as a confirmed cross-tenant read vulnerability because these are public submission forms and RLS applies to writes. It remains a trust-boundary concern: an unauthenticated caller can choose which tenant receives a lead.

Recommended control: resolve the tenant from a signed hospital slug or server-side lookup rather than trusting an arbitrary tenant ID.

## Global Resources

FAQ listing intentionally includes tenant FAQ plus global FAQ content. That behavior is consistent with migration comments. FAQ deletion is unsafe because the delete service ignores tenant and global ownership.

## Doctor Access Boundaries

Most patient, prescription, invoice, laboratory, and appointment queries include tenant filtering and patient-specific handling.

The repository does not establish a clinical-care relationship restriction for doctors. Whether every doctor should see every patient within a hospital is therefore:

**UNVERIFIED — insufficient repository evidence.**

# Pending TODOs & Dead Code

## TODO / FIXME

| Priority | Location | Item | Impact |
|---|---|---|---|
| P1 | `backend/src/services/inventoryService.js:118-119` | Low-stock alert job is not implemented | Staff may not be notified before stock depletion. |
| P1 | `backend/src/services/invoiceService.js:125-129` | Paid-invoice PDF/email job is not wired into the payment workflow | Receipt generation is incomplete. |
| P1 | `backend/src/validators/paymentValidator.js:12-19` | Comment identifies missing gateway binding work | Financial integrity risk. |
| P2 | `backend/src/utils/setupToken.js:1-14` | Legacy temporary-password comments remain | Confusing onboarding/security documentation. |
| P2 | `backend/src/config/cloudinary.js:10-16` | Storage-provider implementation is unresolved | PDF/upload runtime failures. |
| P3 | `backend/migrateSQL/README.md` | Documentation describes only the early migration range | Deployment errors and incomplete operational understanding. |

## Dead / Legacy Code

### Firebase/Firestore

Legacy Firestore code remains under `backend/_legacy-archive/`. Active references also exist in:

- `backend/src/middlewares/appointmentsMiddleware.js`
- `backend/src/middlewares/attendanceMiddleware.js`
- `backend/src/utils/invoiceHelper.js`
- `backend/src/config/firebase.js`
- `backend/test_latency.js`

The archive is not automatically a live vulnerability, but active Firebase helpers and storage naming drift require reachability and deployment cleanup.

### Mongoose/MongoDB

`mongoose`, `mongodb`, and `express-mongo-sanitize` remain dependencies while the primary application uses PostgreSQL/Prisma. Main-route usage was not proven during this audit. This is architecture debt and increases dependency and attack-surface complexity.

### Duplicate Authentication Middleware

`backend/src/utils/auth.js` is a second authentication implementation that:

- Accepts tokens from `req.query.token`.
- Uses a different secret fallback.
- Does not bind the JWT tenant claim to the database user tenant.
- Does not establish `tenantStorage`.

It was not found in the main route registration during this audit, so live reachability is **UNVERIFIED**. It should not remain available as an alternative security boundary.

# Validation Results

## Backend tests

The command:

```bash
npm test -- --passWithNoTests
```

failed because `scripts/e2e.test.js` executes its own asynchronous flow at import time but registers zero Jest tests. Jest reports that the test suite must contain at least one test, leaves asynchronous handles open, and logs after the test run completes.

This means the existing backend test command does not currently provide reliable automated assurance.

## Frontend tests

The frontend uses Vitest. Passing the Jest-specific `--runInBand` flag caused an unknown-option failure. This was a command mismatch, not a confirmed frontend vulnerability.

## Static diagnostics

The diagnostics scan reported numerous existing Tailwind class simplification warnings. No code was changed during the audit.

# Prioritized Action Plan

## P0 — Immediate Security / Data Integrity

| Issue | Files | Recommended fix | Risk if ignored |
|---|---|---|---|
| Document deletion IDOR | `documentService.js`, `documentRepository.js` | Enforce uploader/care relationship/admin authorization. | Unauthorized clinical document destruction. |
| FAQ deletion ownership failure | `faqService.js`, `faqs.js` | Require tenant match and restrict global FAQ deletion. | Cross-tenant/global content destruction. |
| Payment signature not bound to invoice | `paymentService.js`, `payments.js` | Persist and verify gateway order-to-invoice mapping and amount server-side. | False payment settlement. |
| Destructive migration command | `runMigrations.js` | Remove schema drop from production path. | Complete database loss. |

## P1 — Production Blockers

| Issue | Files | Recommended fix | Risk if ignored |
|---|---|---|---|
| System Owner RLS context failure | `tenantMiddleware.js`, `db.js`, platform services | Build an explicit audited platform execution path. | Platform workflows return empty data or fail. |
| PDF storage runtime failure | `pdfQueue.js`, `cloudinary.js` | Resolve provider and test queue end-to-end. | Missing receipts after payment. |
| Test suite is not registered with Jest | `scripts/e2e.test.js`, `package.json` | Convert to real Jest tests or separate executable E2E command. | False confidence in security controls. |
| Sensitive email outbox persistence | `notifyDirect.js`, `uploads/email-outbox` | Remove plaintext credentials/PHI from durable outbox payloads and enforce retention/access controls. | Credential and PHI exposure. |
| Refresh token replay window | `authService.js` | Add refresh-token rotation and reuse detection. | Stolen refresh token remains valid. |

## P2 — Architecture

| Issue | Files | Recommended fix | Risk if ignored |
|---|---|---|---|
| Duplicate authentication/database paths | `utils/auth.js`, `config/prisma.js`, `config/db.js` | Remove or quarantine unreferenced alternatives. | Future route may bypass tenant security. |
| Public tenant attribution | Query/customization controllers and repositories | Resolve tenant from signed/server-validated slug. | Misrouted or misleading tenant leads. |
| Storage/provider naming drift | `cloudinary.js`, Firebase helpers | Use one provider abstraction with tenant-scoped paths. | Runtime and privacy mistakes. |
| Global and tenant billing share invoice model | `schema.prisma`, billing services | Separate platform subscription billing from clinical billing or enforce stronger type constraints. | Privacy and reporting contamination. |
| AI/ABDM integrations require production boundaries | `abdmService.js`, legacy chat/OpenAI paths | Add data classification, consent, timeouts, cost controls, and real-provider status handling. | PHI leakage or misleading clinical behavior. |

## P3 — Performance

| Issue | Files | Recommended fix | Risk if ignored |
|---|---|---|---|
| Queue and Redis configuration is duplicated | `jobs/queue.js`, `queues/connection.js`, `config/redis.js` | Consolidate connection creation and retry policy. | Queue inconsistency and operational failures. |
| Broad `include` responses contain PHI | Patient, invoice, and clinical repositories | Use endpoint-specific `select` projections. | Excessive data exposure and response size. |
| Queue-token concurrency requires verification | Queue repository and migration `0062` | Confirm advisory-lock or atomic allocation under concurrency. | Duplicate/failed waiting-room tokens. |

## P4 — Cleanup

| Issue | Files | Recommended fix | Risk if ignored |
|---|---|---|---|
| Firestore/Mongoose leftovers | `_legacy-archive`, active Firebase helpers, package manifests | Remove after reachability and deployment verification. | Confusing attack surface. |
| Migration documentation drift | `migrateSQL/README.md` | Document all migrations and deployment procedure. | Incorrect production operations. |
| Generated reports/outbox artifacts | `playwright-report`, `test-results`, `uploads/email-outbox` | Apply retention and repository exclusion rules. | Accidental PII/credential retention. |
| Frontend Tailwind diagnostic noise | Multiple frontend pages | Clean warnings separately from security work. | Reduced signal during builds. |

# FINAL VERDICT

Production Readiness:  
**NOT READY**

Critical Findings:  
0 confirmed

High Findings:  
5 confirmed or high-confidence findings, including document deletion, FAQ deletion, payment integrity, destructive migrations, and broken PDF storage

Medium Findings:  
Several, including public tenant attribution, refresh-token replay, legacy security paths, and billing-model ambiguity

Low Findings:  
Several maintainability and cleanup findings

Confirmed Cross-Tenant Risks:  
1 direct object-authorization risk affecting documents, plus FAQ deletion scope failure

Confirmed Authentication/RBAC Risks:  
1 confirmed object-level authorization failure; duplicate unverified authentication path also exists

Confirmed Data Privacy Risks:  
FAQ cross-tenant deletion, broad clinical access requiring policy confirmation, and durable email/outbox handling of sensitive content

Confirmed Financial Integrity Risks:  
Payment verification is not bound to invoice identity or amount; PDF receipt workflow can fail after payment

Major Technical Debt Areas:  
Legacy Firestore/Mongoose code, duplicate Redis/database/auth abstractions, migration drift, incomplete queue workflows, and invalid automated test registration

The architecture has a promising security foundation, particularly forced PostgreSQL RLS and tenant-aware relationships. It requires remediation and integration testing before it can safely process production healthcare, payment, and multi-tenant data.
