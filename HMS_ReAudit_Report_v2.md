# 🏥 HMS Security Re-Audit Report — v2
**Audit Type:** Full Re-Audit After Hardening Phases  
**Auditor:** Senior Security Auditor / Production QA Engineer  
**Date:** February 25, 2026  
**Live URL:** https://hms-lovat-one.vercel.app  
**Previous Audit Score:** Security 3/10 | Production Readiness 2/10

---

## FIXES VERIFIED ✅ — What Was Actually Fixed

Before the findings, here is a fair accounting of genuine progress:

| Previous Issue | Status |
|---|---|
| Hardcoded `admin@gmail.com / admin@123` bypass in login route | ✅ **REMOVED** |
| Auto-login after password reset | ✅ **FIXED** — now returns `{ ok: true }` only |
| Temp passwords sent in email | ✅ **FIXED** — setup-link flow implemented |
| Debug endpoint `/api/auth/debug-test` | ✅ **REMOVED** |
| `JWT_SECRET` used as both access + refresh secret | ✅ **FIXED** — separate secrets |
| `ACCESS_TOKEN_EXPIRY` now 15m | ✅ **FIXED** |
| Rate limiting on login, forgot-password, reset-password | ✅ **ADDED** |
| Input validation with `express-validator` | ✅ **ADDED** to auth routes |
| MongoDB sanitization (`express-mongo-sanitize`) | ✅ **ADDED** |
| Helmet with custom CSP | ✅ **ADDED** |
| Static `/uploads` now protected with auth | ✅ **FIXED** — `uploadsRouter` |
| Cloudinary integration for file uploads | ✅ **ADDED** — `multer.memoryStorage()` |
| CSRF double-submit pattern | ✅ **PARTIALLY IMPLEMENTED** (flaw noted below) |
| JWT secrets properly guarded (`if (!accessSecret) throw`) | ✅ **ADDED** |

Good progress. However, **several critical and medium issues remain** that prevent production deployment.

---

## 🔴 CRITICAL ISSUES — Must Fix Before Deployment

---

### 🔴 CRIT-01: Firebase Service Account Private Key STILL Committed — Key NOT Rotated

**File:** `backend/service-account.json`  
**Severity:** CATASTROPHIC — **UNCHANGED FROM PREVIOUS AUDIT**

The same private key that was flagged in Audit #1 is still committed to the repository. The `private_key_id` is identical: `7a773ca2f5ad5b5d7bf737472e63cd89b3cf1f6c`.

This key was in a ZIP file that was shared for the previous audit. It must be treated as **fully compromised**. Simply removing it from the repository is not enough — it must be **revoked in Google Cloud Console** and a new key generated and stored only as an environment variable.

Furthermore, a file named **`private.pem`** was submitted in this audit package as a separate file. This contains a different RSA private key. Whether this is a JWT signing key, a TLS certificate, or another service account is unclear — but **no private key should ever be submitted in a zip file for review.**

**The `.gitignore` does not include `service-account.json` or `*.pem` or `*.json` (credentials).** This is a systemic process failure.

**Immediate Required Actions:**
1. Go to [Google Cloud Console → IAM → Service Accounts → Keys](https://console.cloud.google.com/iam-admin/serviceaccounts) and **delete key `7a773ca2f5ad5b5d7bf737472e63cd89b3cf1f6c` immediately.**
2. Identify what `private.pem` is and revoke/rotate it.
3. Remove both files from git history using BFG Repo Cleaner or `git filter-repo`.
4. Add to `.gitignore`: `service-account.json`, `*.pem`, `*.key`, `cookies.txt`
5. Store credentials via environment variables only.

---

### 🔴 CRIT-02: Live Credentials Still Committed in `.env` File

**File:** `backend/.env` (tracked by git, submitted in zip)  
**Severity:** CRITICAL

Despite secret rotation (Razorpay keys are different from Audit #1), the `.env` file is **still committed to the repository.** The following active credentials are exposed:

- `RAZORPAY_KEY_SECRET=U2WcUuifxZpHTwHnitk8Q8ku` (new, but now exposed)
- `RAZORPAY_WEBHOOK_SECRET=9231f433967e5e8c59d38486fe174da4003b80ac...` (new, but now exposed)
- `CLOUDINARY_API_SECRET=2SrBW1kekGX0e_vVZ7R_Jax15d8` (new credential, immediately exposed)
- `SMTP_PASS=mtzpudcmshhjrbli` (same Gmail app password as Audit #1 — **NOT rotated**)
- `ACCESS_TOKEN_SECRET` and `REFRESH_TOKEN_SECRET` (strong new values, but now exposed)

**Rotating credentials while committing them achieves nothing.** Every secret in this file must be rotated again, and the `.env` file must be removed from git tracking permanently. The root-level `.gitignore` is still missing.

---

### 🔴 CRIT-03: CSRF Implementation Is Broken — The `_csrf` Cookie Is `httpOnly: true`

**File:** `backend/src/routes/auth.js` — Lines 43–50  
**Severity:** HIGH

The CSRF protection uses the double-submit cookie pattern, but it is implemented incorrectly in a way that makes it non-functional:

```js
res.cookie('_csrf', token, {
    httpOnly: true,  // ← BUG: JS cannot read httpOnly cookies
    ...
})
res.json({ csrfToken: token })  // Token also returned in JSON body
```

The double-submit pattern **requires the browser's JavaScript to read the cookie value** and re-submit it in a header. With `httpOnly: true`, JavaScript cannot access the `_csrf` cookie at all.

**What actually happens:** The frontend stores the `csrfToken` from the JSON response body in a JS variable (`csrfTokenStr`), and sends it as `x-csrf-token`. The middleware then compares `req.cookies._csrf` (from the httpOnly cookie) with `req.headers['x-csrf-token']` (from the JS variable). Since the cookie is set on the same domain by the server, the server can read it — so the check passes. But this creates a false sense of security:

- The defense only works as long as an attacker cannot obtain the token from the JSON response, which requires XSS — but if XSS is possible, the in-memory `csrfTokenStr` variable is equally readable.
- The `_csrf` cookie being `httpOnly` prevents the legitimate intended defense (cookie-reading by JS for double-submit). The pattern is being applied in a confused hybrid form.

**Fix:** Use a proper, established library. The most appropriate for this setup is `csrf-csrf` (double CSRF):
```bash
npm install csrf-csrf
```
```js
import { doubleCsrf } from 'csrf-csrf'
const { generateToken, doubleCsrfProtection } = doubleCsrf({
  getSecret: () => process.env.CSRF_SECRET,
  cookieName: '__Host-psifi.x-csrf-token',
  cookieOptions: { sameSite: 'none', secure: true, httpOnly: true },
})
```

---

### 🔴 CRIT-04: Bootstrap Function Prints Director Password to Server Console/Logs

**File:** `backend/src/utils/bootstrap.js` — Line 12

```js
console.log('Created default director user:', { email, password })
```

This logs the director's plaintext password to `stdout` every time a new director account is bootstrapped. In production, stdout is captured by platform logs (Render, Railway, etc.) and may be visible to anyone with deployment log access.

Additionally, the bootstrap still falls back to `'admin@gmail.com'` and `'admin123'` if environment variables are not set — creating a predictable default credential if `ADMIN_EMAIL` and `ADMIN_PASSWORD` are not explicitly configured.

**Fix:**
```js
// Remove the console.log with password
console.log('Created default director user:', email) // No password
// And enforce that env vars are set:
if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) {
  throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD must be set in environment')
}
```

---

### 🔴 CRIT-05: Payment Simulation Endpoint Active in Production

**File:** `backend/src/routes/payments.js` — Line 831

```js
router.post('/razorpay/simulate/:prId', protect, allowRolesWithSubadminFeature(['admin', 'director', 'subadmin'], 'manage_payments'), ...)
```

This endpoint allows any admin or director to **mark any payment request as paid without actual payment processing.** In a real hospital billing system, this is a financial fraud vector — a malicious admin could simulate payments to bypass billing, manipulate revenue records, or cover up fraud.

**Fix:** Gate this behind an explicit environment variable and only enable it in non-production environments:
```js
if (process.env.NODE_ENV !== 'production') {
  router.post('/razorpay/simulate/:prId', ...)
}
```
Or remove it entirely and replace with a documented Razorpay test mode process.

---

## 🟡 MEDIUM SEVERITY ISSUES

---

### 🟡 MED-01: 30 Development/Debug/Test Files Still in the Repository Root

The following files remain committed and were **not removed** despite the claimed hardening:

**Test scripts (30 files in `backend/` root):**
`check_admin.js`, `check_payment_requests.js`, `check_user.js`, `find_user.js`, `fix_dir.js`, `fix_missing_status.js`, `get_prs.js`, `list_users.js`, `make_director.js`, `test_admin_actions.js`, `test_appointments.js`, `test_count.js`, `test_dash.js`, `test_doc_apis.js`, `test_doctor_apply.js`, `test_email.js`, `test_find_one.js`, `test_firestore_index.js`, `test_login.js`, `test_patient_apis.js`, `test_pay.js`, `test_refresh.js`, `test_sales.js`, `test_save_availability.js`, `test_slots_api.js`, `test_smtp.js`, `test_tenant_login.js`, `test_tenant_me.js`, `test_vite.js`, `verify_dash.js`

**Debug/seed utilities in `src/utils/`:**
`seed_firebase.js`, `debug_firestore.js`, `whatsapp_test.js`

**Log/output files still committed:**
`backend.log`, `backend_dev.log`, `cookies.txt`, `crash.log`, `debug_log.txt`, `debug_out.txt`, `out_prs.txt`, `server.log`, `server_crash_log.txt`, `server_output.log`

**Risk:** `seed_firebase.js` contains hardcoded real email addresses and weak passwords (`password`, `12345678`, `c59d5f6b`). `make_director.js` hardcodes `admin@gmail.com`. `list_users.js` dumps all user emails and roles. `cookies.txt` contains a captured CSRF token. These files represent an attack surface and data privacy violation.

**Action:** Remove all of the above. They have no place in a production repository.

---

### 🟡 MED-02: Prescriptions and Plan Receipts Still Written to Local Disk

**Files:** `backend/src/routes/prescriptions.js` (lines 489, 628, 795), `backend/src/routes/payments.js` (line 249), `backend/src/routes/invoices.js` (line 195)

Despite claiming Cloudinary migration, prescription PDFs and plan receipt PDFs are **still written to local filesystem** using `fs.createWriteStream` and `fs.writeFileSync`. On a serverless/ephemeral deployment (Render, Railway), the local filesystem is wiped on every restart or deploy, causing these files to permanently disappear.

This also means the `uploads/prescriptions/`, `uploads/plan-receipts/` directories still exist and are **served via the authenticated `uploadsRouter`** — but the files won't survive restarts.

**Fix:** Complete the Cloudinary migration for these file types using the established `uploadToCloudinary` helper and store the returned Cloudinary URL in the database instead of a local path.

---

### 🟡 MED-03: `change-password` Endpoint Has No Password Complexity Validation

**File:** `backend/src/routes/auth.js` — Lines 404–424

The `/change-password` route only checks `if (!currentPassword || !newPassword)` — it accepts a 1-character password. The register and reset-password routes were properly updated with complexity checks, but this endpoint was missed.

**Fix:**
```js
if (!newPassword || newPassword.length < 8 || !/[A-Za-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
  return res.status(400).json({ error: 'Password must be at least 8 characters with letters and numbers' })
}
```

---

### 🟡 MED-04: `/register` Endpoint Has No Rate Limiting

**File:** `backend/src/routes/auth.js` — Line 97

`authLimiter` was applied to login, forgot-password, reset-password, and refresh-token — but **not to `/register`**. An attacker can create unlimited accounts, spam the system with registrations, or use it as a vehicle for email enumeration and storage exhaustion.

**Fix:** Add `authLimiter` to the register route:
```js
router.post('/register', authLimiter, [...validators], async (req, res) => {
```

---

### 🟡 MED-05: `cookies.txt` Contains a Captured CSRF Token — Committed to Repo

**File:** `backend/cookies.txt`

This file was generated by `curl --cookie-jar` and contains a captured `_csrf` token value:
```
_csrf   a381d9bdaf4576d3644db6bdaa854699...
```

While this particular token is likely expired, this represents a pattern of developers capturing session data to debug authentication and committing it to source control. Remove immediately and add `cookies.txt`, `*.txt` (selectively), to `.gitignore`.

---

### 🟡 MED-06: CORS Allows Requests With No `Origin` Header (Server-to-Server Bypass)

**File:** `backend/src/app.js` — Line 69

```js
if (!origin) return callback(null, true);
```

Any request without an `Origin` header bypasses CORS entirely. While this is technically correct for non-browser clients, it means any server, script, or tool (`curl`, Postman, automated attackers) can access all API endpoints regardless of the CORS allowlist. Combined with no API key requirement for machine-to-machine access, this neutralizes the CORS protection.

For a healthcare API, all cross-origin requests — including from automated tools — should require authentication, which they do via JWT. CORS is a browser control, not a security boundary. However, this should be documented explicitly so future developers don't rely on CORS as a security control.

---

### 🟡 MED-07: `razorpay/debug` Endpoint Exposes Financial Data in Production

**File:** `backend/src/routes/payments.js` — Line 853

This authenticated endpoint returns the 10 most recent payment requests and invoices including Razorpay order IDs and payment details. While it requires admin/director access, debug endpoints expose internal data structures and should not exist in production. This is the same category of issue as the auth debug endpoint that was correctly removed.

---

### 🟡 MED-08: `SMTP_PASS` (Gmail App Password) Not Rotated Since Audit #1

The Gmail app password `mtzpudcmshhjrbli` for `salunkeshravani561@gmail.com` is **identical** to the password exposed in the first audit. Even though this email was shared with the previous auditor, the password was not rotated. Anyone who read the first report has this credential.

**Action:** Revoke this Google App Password immediately in [Google Account Security](https://myaccount.google.com/apppasswords) and generate a new one.

---

### 🟡 MED-09: `connectSrc: ["'self'", "https:"]` CSP Is Too Permissive

**File:** `backend/src/app.js` — Line 95

The CSP directive `connectSrc: ["'self'", "https:"]` allows the frontend to make `fetch`/`XMLHttpRequest` calls to **any HTTPS URL**. This completely undermines the XSS mitigation value of CSP for network exfiltration — if XSS is achieved, stolen data can be sent to any HTTPS endpoint.

**Fix:** Enumerate specific allowed domains:
```js
connectSrc: ["'self'", "https://hms-backend-jwe6.onrender.com", "https://api.cloudinary.com"]
```

---

### 🟡 MED-10: 1.3MB Frontend Bundle — Not Addressed

The frontend JavaScript bundle remains at **1.3MB** (same as Audit #1). No code splitting has been implemented. This is unchanged and remains a significant performance and usability problem for medical staff on limited-bandwidth hospital networks.

---

## 🟢 MINOR IMPROVEMENTS

---

### 🟢 MIN-01: `seed_firebase.js` Contains Real Email Addresses of Developers

The seed file includes `payalsalunke1930@gmail.com`, `shravani.salunke25@vit.edu`, and other addresses with their passwords. Even as a seeding script, this should use fake data or environment variables — not real personal email addresses committed to source code.

---

### 🟢 MIN-02: `change-password` Does Not Rotate `sessionId`

When a user changes their password, existing sessions on other devices remain valid. The commented-out line `// user.sessionId = crypto.randomUUID()` should be uncommented. This is a standard security practice: changing your password should log you out everywhere else.

---

### 🟢 MIN-03: No Error Boundaries in React Frontend

Unchanged from Audit #1. A component crash causes a blank screen. React `ErrorBoundary` components should wrap all major route-level components.

---

### 🟢 MIN-04: `notify.js` Writes to Local Disk (`email-outbox`)

**File:** `backend/src/utils/notify.js` — Line 205

Email outbox files are still written to `uploads/email-outbox/` on the local filesystem. Same ephemeral storage problem as the prescription PDFs.

---

### 🟢 MIN-05: No Audit Log for Patient Data Access

PHI (Protected Health Information) access still has no audit trail. Every read of a patient record, prescription, or medical document should be logged with: `who` accessed `what` at `when` from `which IP`. This is a regulatory requirement in healthcare systems (HIPAA in the US; applicable equivalents in India under DISHA).

---

### 🟢 MIN-06: `check_admin.js` Lists Users and Roles Without Tenant Scoping

The `check_admin.js` and `list_users.js` scripts dump all user email addresses and roles from the database. If these ever get executed against the production database (even accidentally), all user PII is printed to console.

---

## ⚙️ ARCHITECTURE REVIEW

**Genuine Improvements Since Audit #1:**
- The auth architecture is now structurally sound: separate access/refresh secrets, 15-minute access tokens with rotation, proper session invalidation on login.
- The setup-link flow for doctor onboarding is correctly implemented.
- Cloudinary integration is correctly structured using `memoryStorage` — the right approach.
- The authenticated uploads router with tenant-scoped access control is well-designed.
- MongoDB sanitization and input validation represent a meaningful security improvement.

**Remaining Architectural Concerns:**
- **Two storage systems in parallel:** Cloudinary is configured but prescriptions and plan receipts still use the local filesystem. The application has split-brain storage — some files go to Cloudinary, some to local disk. This needs to be unified.
- **Service account credential management** remains a systemic process problem. The team needs a secrets management workflow (e.g., `direnv`, Doppler, or deployment platform secrets) — not just `.gitignore`.
- **The `uploads/` directory still exists** as a local path and is referenced in multiple routes. A deployment to a fresh server would require creating this directory manually. This is a deployment reliability risk.
- **No API versioning** (`/api/v1/`) — any breaking change requires coordinating frontend and backend deploys simultaneously.

---

## 🔐 SECURITY SCORE

| Category | Audit #1 | Audit #2 | Change |
|---|---|---|---|
| Authentication | 4/10 | 7/10 | ⬆️ +3 |
| Authorization/RBAC | 6/10 | 6/10 | → |
| Secrets Management | 1/10 | 2/10 | ⬆️ +1 (rotated some, still committed) |
| Input Validation | 3/10 | 6/10 | ⬆️ +3 |
| CSRF/Security Headers | 2/10 | 5/10 | ⬆️ +3 (CSP good, CSRF broken) |
| Rate Limiting | 0/10 | 6/10 | ⬆️ +6 |
| Data Protection | 2/10 | 4/10 | ⬆️ +2 (uploads protected, disk still used) |
| Dev Hygiene | 1/10 | 1/10 | → (30+ dev files still committed) |

### **Overall Security Score: 5/10** *(was 3/10)*

---

## 🚀 PRODUCTION READINESS SCORE

| Category | Audit #1 | Audit #2 | Change |
|---|---|---|---|
| Auth Flows | 4/10 | 8/10 | ⬆️ +4 |
| Secret Handling | 1/10 | 2/10 | ⬆️ +1 |
| Performance | 4/10 | 4/10 | → |
| Error Handling | 5/10 | 5/10 | → |
| Storage Consistency | 2/10 | 4/10 | ⬆️ +2 |
| Dev Artifact Cleanup | 1/10 | 1/10 | → (30+ test files remain) |
| Regulatory Compliance | 2/10 | 2/10 | → |

### **Overall Production Readiness Score: 4/10** *(was 2/10)*

---

## 🏁 FINAL VERDICT

> ## ❌ NOT SAFE TO DEPLOY TO REAL USERS

Significant and genuine progress has been made. The authentication architecture is now fundamentally sound. The CSP, rate limiting, validation, and CSRF attempt all represent real effort. However, the system **cannot be deployed to handle real patient data** for the following non-negotiable reasons:

**The two blockers that alone prevent deployment:**

1. **The Firebase service account private key is still in the repository and still NOT revoked.** This gives anyone with repository access full control of the entire database — all patient data, all medical records, all hospital financial data. This has been true since before Audit #1. Until this key is revoked in Google Cloud Console, no security improvement to the application code matters. The database itself is compromised.

2. **All credentials are still committed in `.env`.** Every secret that was "rotated" was immediately re-exposed in the same file that was submitted for this audit. This is a process failure: the team needs a secrets management workflow before any production deployment.

### Recommended Path to Production

**This Week (Blockers):**
1. Revoke the Firebase service account key (`7a773ca2f5ad5b5d7bf737472e63cd89b3cf1f6c`) in Google Cloud Console
2. Revoke and regenerate the Cloudinary API secret, Razorpay webhook secret, JWT secrets, and SMTP app password — all newly exposed
3. Remove `.env` and `service-account.json` from git tracking and history
4. Set up environment variables exclusively through the deployment platform (Render dashboard, Vercel dashboard)
5. Fix bootstrap to throw if env vars are absent (no default passwords)

**Week 2 (Code Fixes):**
6. Remove all 30+ test/debug/seed files and log files from the repo
7. Fix `change-password` validation and rate limiting on `/register`
8. Remove or environment-gate the `simulate/:prId` payment endpoint
9. Complete Cloudinary migration for prescriptions and plan receipt PDFs
10. Fix CSRF implementation using `csrf-csrf` library

**Week 3 (Pre-Launch):**
11. Implement code splitting (bundle < 300KB)
12. Add React error boundaries
13. Implement audit logging for PHI access
14. Add `sessionId` rotation on password change
15. Conduct end-to-end testing of all auth flows on the live environment

---
*This report is based on static source code analysis of the submitted ZIP files. All line numbers reference the updated v2 codebase.*
