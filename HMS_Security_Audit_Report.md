# 🏥 Hospital Management System — Full Production Security Audit

**Audited By:** Senior QA Engineer / Security Auditor  
**Date:** February 24, 2026  
**Live URL:** https://hms-lovat-one.vercel.app  
**Audit Scope:** Full source code (backend + frontend), architecture, auth flows, RBAC, OWASP Top 10

---

## 🔴 CRITICAL ISSUES — Must Fix Before Any Production Use

---

### 🔴 CRIT-01: Firebase Service Account Private Key Committed to Source Control

**File:** `backend/service-account.json`  
**Severity:** CATASTROPHIC

The full Firebase Admin SDK private key is committed directly into the repository ZIP. This includes:
- RSA private key (`-----BEGIN PRIVATE KEY-----`)
- `client_email`: `firebase-adminsdk-fbsvc@hospital-ms-25052.iam.gserviceaccount.com`
- `project_id`: `hospital-ms-25052`

**Why This Is Dangerous:**  
Anyone with access to this repository has full admin access to your Firebase/Firestore project — they can read, write, delete all patient data, impersonate any user, and destroy the entire database.

**Immediate Actions Required:**
1. **Rotate/revoke** this service account key in the Google Cloud Console immediately.
2. Remove `service-account.json` from the repository and all git history (`git filter-branch` or BFG Repo Cleaner).
3. Add to `.gitignore`: `service-account.json`, `*.json` (sensitive), `*.pem`, `*.key`
4. Store the credentials as an environment variable:
```bash
GOOGLE_APPLICATION_CREDENTIALS_JSON='{"type":"service_account",...}'
```
Then load it in code:
```js
const creds = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON)
admin.initializeApp({ credential: admin.credential.cert(creds) })
```

---

### 🔴 CRIT-02: Hardcoded Director Credentials in Production Code

**File:** `backend/src/routes/auth.js` — Line 147  
**Severity:** CRITICAL

```js
const isHardcodedDirector = email === 'admin@gmail.com' && password === 'admin@123' && !hospitalSlug;
```

**Why This Is Dangerous:**  
- This is a universal backdoor bypassing all database authentication.
- The password `admin@123` is one of the first passwords attackers try in credential stuffing attacks.
- The "director-hardcoded-id" synthesized user object bypasses session validation, bcrypt comparison, and all security checks.
- This hardcoded ID is also special-cased in `refresh-token` endpoint (line 462), meaning it persists across server restarts.
- In a real hospital, the Director has access to ALL tenant data, billing, patient records, and staff information.

**Fix:** Remove entirely. Create the director account properly in the database using an environment-variable-driven bootstrap script:
```js
const email = process.env.DIRECTOR_EMAIL
const password = process.env.DIRECTOR_PASSWORD
// Hash and store in DB on first run only
```

---

### 🔴 CRIT-03: Real Credentials and API Keys Committed in `.env` File

**File:** `backend/.env` (committed to zip/repo)  
**Severity:** CRITICAL

The following live credentials are exposed:
- `JWT_SECRET=f59de4160bd55f0dbb61acc26fa82de6`
- `ACCESS_TOKEN_SECRET=f59de4160bd55f0dbb61acc26fa82de6` (same as JWT_SECRET — single point of failure)
- `RAZORPAY_KEY_ID=rzp_test_Rwitl2wT3yfrgD`
- `RAZORPAY_KEY_SECRET=w1U3C66Dpf9plhVIJhqtQikz`
- `RAZORPAY_WEBHOOK_SECRET=mysecret1234598760`
- `SMTP_PASS=mtzpudcmshhjrbli` (Google App Password)
- `SMTP_USER=salunkeshravani561@gmail.com`

**Why This Is Dangerous:**  
- The JWT secret being known means an attacker can forge valid JWT tokens for any user, including the director.
- The Razorpay key secret allows creating, modifying or canceling payment orders.
- The SMTP password allows sending emails as your hospital's address (phishing, impersonation).

**Immediate Actions:**
1. Rotate ALL exposed secrets immediately.
2. Never commit `.env` files. Verify `.gitignore` is applied at git tracking time.
3. Use different secrets for `ACCESS_TOKEN_SECRET` and `REFRESH_TOKEN_SECRET`.
4. Use a secrets manager (Railway Secrets, Render Env Vars, AWS Secrets Manager) for production.

---

### 🔴 CRIT-04: Auto-Login After Password Reset (Violates Your Own Requirements)

**File:** `backend/src/routes/auth.js` — Lines 308–325  
**Severity:** HIGH

The `/api/auth/reset-password` endpoint generates and returns a full access token + refresh cookie immediately after password reset. This means anyone who intercepts or steals a password reset link gets automatically logged in.

**Your stated requirement was:** "No automatic login after clicking email links"  
**Current behavior violates this requirement.**

**Fix:** Remove token issuance from the reset endpoint. Return only `{ ok: true, message: "Password updated. Please log in." }` and redirect the user to the login page:
```js
// After saving the new password:
clearRefreshCookie(res)
return res.json({ ok: true, message: 'Password reset successful. Please log in.' })
```

---

### 🔴 CRIT-05: Temporary Passwords Sent in Plain Text via Email

**File:** `backend/src/utils/emailTemplates.js` — Lines 56–63  
**File:** `backend/src/routes/doctorApplications.js` — Line 75

When a doctor is approved, a plaintext temporary password is generated and included in the approval email:
```js
const { html, attachments } = doctorApprovalTemplate(app, { tempPassword: genPass }, targetTenant)
```
The email template renders: `<tr><th>Temporary Password</th><td>${c.tempPassword || '—'}</td></tr>`

**Your stated requirement was:** "Temporary passwords must not be visible in email"  
**Current behavior violates this requirement.**

**Fix:** Use a one-time setup link instead:
```js
// Generate a setup token, store its hash in DB
const setupToken = crypto.randomBytes(32).toString('hex')
user.passwordResetToken = crypto.createHash('sha256').update(setupToken).digest('hex')
user.passwordResetExpires = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24h
// Email the link, not the password
const setupUrl = `${frontendUrl}/setup-password?token=${setupToken}&email=${email}`
```

---

### 🔴 CRIT-06: Zero Rate Limiting on Authentication Endpoints

**Severity:** CRITICAL

No rate limiting exists anywhere in the application. The login, forgot-password, and reset-password endpoints are fully open to brute force attacks.

**Impact:**
- Attackers can attempt unlimited login attempts against any account.
- The forgot-password endpoint can be abused to spam any email address.
- For a hospital system handling patient PHI (Protected Health Information), this is a HIPAA/compliance violation.

**Fix:** Install and apply `express-rate-limit`:
```js
import rateLimit from 'express-rate-limit'

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 10,                     // 10 attempts
  message: { error: 'Too many attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
})

router.post('/login', authLimiter, ...)
router.post('/forgot-password', authLimiter, ...)
router.post('/reset-password', authLimiter, ...)
```

---

### 🔴 CRIT-07: Debug Endpoint Exposed in Production

**File:** `backend/src/routes/auth.js` — Line 17

```js
router.get('/debug-test', (req, res) => {
  import('fs').then(fs => {
    fs.appendFileSync('debug_log.txt', `[Debug Test] ...`)
    res.send('Logged')
  })
})
```

This unauthenticated endpoint writes to the server filesystem. It is accessible at `/api/auth/debug-test` with no authentication.

**Fix:** Remove entirely before any deployment.

---

### 🔴 CRIT-08: `debug_log.txt` Contains 2.7MB of Server Request Logs — Committed to Repo

**File:** `backend/debug_log.txt` (2.7MB)

This file logs every API request including authentication attempts and is committed to version control. It records login attempts with timestamps.

**Fix:** Remove from repo, add to `.gitignore`, and implement structured logging to a proper logging service (Datadog, Logtail, etc.) instead of flat files.

---

### 🔴 CRIT-09: No CSRF Protection

**Severity:** HIGH

The application uses `HttpOnly` cookies for refresh tokens but has no CSRF (Cross-Site Request Forgery) protection. An attacker on a malicious website can trigger authenticated API calls (logout, data mutations) using the user's browser session.

**Fix:** Implement the `SameSite=Strict` cookie setting OR use `csurf` middleware OR implement the double-submit cookie pattern. The cookie already uses `SameSite: 'none'` in production (required for cross-domain), which makes it fully CSRF-vulnerable.

---

## 🟡 MEDIUM SEVERITY ISSUES

---

### 🟡 MED-01: No Input Validation / Sanitization Library

No `express-validator`, `joi`, or `zod` validation is used anywhere in the backend. Raw `req.body` fields are used directly in database queries.

**Risk:** NoSQL injection, unexpected data types causing server crashes, missing field validation leaking stack traces.

**Fix:** Add validation middleware:
```js
import { body, validationResult } from 'express-validator'

router.post('/register', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }),
  body('name').trim().notEmpty().escape(),
], async (req, res) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() })
  // ...
})
```

---

### 🟡 MED-02: No mongo-sanitize / NoSQL Injection Protection

Mongoose queries use raw `req.body` values without sanitization. An attacker could send `{ "email": { "$gt": "" } }` to bypass email lookup checks.

**Fix:** Add `express-mongo-sanitize`:
```js
import mongoSanitize from 'express-mongo-sanitize'
app.use(mongoSanitize())
```

---

### 🟡 MED-03: Password Reset Token Exposed in Email URL (Token in GET Query Parameter)

**File:** `backend/src/routes/auth.js` — Line 262

```js
const resetUrl = `${base}/reset-password?token=${rawToken}&email=${encodeURIComponent(email)}`
```

Reset tokens in query parameters are logged in server access logs, browser history, and email service logs. They can also leak via HTTP Referer headers.

**Fix:** Use `POST` redirect after token validation, or use shorter-lived tokens (30 minutes instead of 1 hour) and clear from URL on arrival via `history.replaceState`.

---

### 🟡 MED-04: `/uploads` Directory Served Without Authentication

**File:** `backend/src/app.js` — Line 87

```js
app.use('/uploads', express.static('uploads'))
```

Medical documents, prescription images, and patient ID photos uploaded to `uploads/` are publicly accessible by anyone who guesses or constructs a URL. This is a HIPAA violation for patient medical records.

**Fix:** Remove public static serving, use authenticated endpoint:
```js
router.get('/uploads/:category/:file', protect, (req, res) => {
  // Validate the user has access to this file
  const safePath = path.join('uploads', req.params.category, req.params.file)
  res.sendFile(path.resolve(safePath))
})
```

---

### 🟡 MED-05: No Password Complexity Enforcement on Backend

The backend does not enforce minimum password length, complexity, or common password checks. A 1-character password is accepted. The frontend has a minimum of 8 characters in the reset form only.

**Fix:** Enforce on the backend in all password-setting routes:
```js
if (!password || password.length < 8) {
  return res.status(400).json({ error: 'Password must be at least 8 characters' })
}
// Optionally check against common passwords list
```

---

### 🟡 MED-06: `upcharApiKey` Stored in `localStorage`

**File:** `frontend/src/pages/DoctorPrescriptions.jsx` — Lines 11, 46, 120

```js
const [apiKey, setApiKey] = useState(() => window.localStorage.getItem('upcharApiKey') || '')
```

API keys stored in `localStorage` are accessible to any JavaScript running on the page (XSS vulnerability). If an XSS is achieved, this API key is immediately compromised.

**Fix:** Store API keys in memory (React state only), or if persistence is needed, use a backend-managed integration where the API key is stored server-side.

---

### 🟡 MED-07: Frontend Bundle is 1.3MB (Unacceptable for Medical Use)

**File:** `frontend/dist/assets/index-C1H1koPQ.js` — 1.3MB

A single 1.3MB JavaScript bundle is delivered to all users. On a 3G connection (common in Indian hospitals), this takes 5–10 seconds to load. For critical medical staff who need fast access to patient data, this is unacceptable.

**Fix:** Implement code splitting with React lazy loading:
```jsx
const DoctorDashboard = React.lazy(() => import('./pages/DoctorDashboard'))
const Prescriptions = React.lazy(() => import('./pages/Prescriptions'))
```
Expected improvement: reduce initial bundle to ~200–300KB.

---

### 🟡 MED-08: Logout Does Not Verify Token Before Invalidating Session

**File:** `backend/src/routes/auth.js` — Lines 410–430

The logout route uses `jwt.decode()` (not `jwt.verify()`) to extract the user ID. This means the endpoint will accept expired, tampered, or invalid tokens and attempt to invalidate the session anyway. More importantly, it silently fails if the token is forged.

**Fix:** Use `jwt.verify()` in the logout route, and require the `protect` middleware:
```js
router.post('/logout', protect, async (req, res) => {
  const user = await User.findById(req.userId)
  if (user) { user.sessionId = crypto.randomUUID(); await user.save() }
  clearRefreshCookie(res)
  res.json({ ok: true })
})
```

---

### 🟡 MED-09: Director-Specific Features Stored in `localStorage`

**File:** `frontend/src/pages/director/FeaturesPage.jsx` — Lines 76, 111

```js
return JSON.parse(localStorage.getItem('director:selectedFeatures') || '{}')
localStorage.setItem('director:selectedFeatures', JSON.stringify(selected))
```

Director feature selections stored in `localStorage` could be manipulated by XSS, or by the user themselves to bypass UI-level feature gating.

---

### 🟡 MED-10: Helmet Used With Default Configuration (Missing CSP)

**File:** `backend/src/app.js` — Line 83

`helmet()` is called with no custom configuration. The default Helmet does not configure a strong Content Security Policy (CSP), which is the primary defense against XSS attacks. For a medical system that accepts user inputs and renders them, this is a medium-severity gap.

**Fix:**
```js
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", process.env.API_URL],
    }
  }
}))
```

---

## 🟢 MINOR IMPROVEMENTS

---

### 🟢 MIN-01: `ACCESS_TOKEN_SECRET` and `JWT_SECRET` Are the Same Value

Both are set to `f59de4160bd55f0dbb61acc26fa82de6`. While the code handles this, having different secrets is a defense-in-depth measure. Access and refresh tokens should use independent secrets.

---

### 🟢 MIN-02: Debug and Utility Scripts Committed to Production Repo

Files like `find_user.js`, `test_sales.js`, `check_counts.js`, `fix_dir.js`, `make_director.js`, `seed_firebase.js`, etc. are committed to the backend repo. These are development/maintenance utilities that should not be in the production codebase.

---

### 🟢 MIN-03: No Error Boundaries in React Frontend

If any component crashes, the entire application becomes a blank screen. React error boundaries should be implemented at the route level to allow graceful degradation.

```jsx
class ErrorBoundary extends React.Component {
  state = { hasError: false }
  static getDerivedStateFromError() { return { hasError: true } }
  render() {
    if (this.state.hasError) return <div>Something went wrong. Please refresh.</div>
    return this.props.children
  }
}
```

---

### 🟢 MIN-04: No Logging Framework — Raw `console.error` + File Appends

Application logging uses `console.error` and `fs.appendFileSync('debug_log.txt', ...)` scattered throughout the codebase. This is fragile, not searchable, and not suitable for production incident response.

**Recommendation:** Use Winston or Pino with log levels, structured output, and integration to a log management platform.

---

### 🟢 MIN-05: No Structured API Response for Validation Errors

Error responses are inconsistent — sometimes `{ error: "string" }`, sometimes `{ errors: [] }`. Standardize all API error responses to a consistent envelope.

---

### 🟢 MIN-06: `ACCESS_TOKEN_EXPIRY` Defaults to `1d` (Too Long)

A 1-day access token means that if a token is stolen (e.g., via XSS), the attacker has 24 hours of access. Short-lived access tokens (15 minutes) combined with automatic refresh are the industry standard.

**Fix:** Change to `15m` access token with the existing refresh token rotation pattern:
```
ACCESS_TOKEN_EXPIRY=15m
```

---

### 🟢 MIN-07: No Audit Logging for Sensitive Medical Actions

Patient record access, prescription creation/modification, discharge, and billing operations have no audit log. For healthcare systems, audit trails are a regulatory requirement (HIPAA requires access logs for PHI).

---

### 🟢 MIN-08: `.env` File Not in `.gitignore` at Repo Root Level

The backend `.gitignore` contains `.env`, but the root-level repo has no `.gitignore`. The `.env` was committed into the zip file directly, confirming it was tracked by git.

---

## ⚙️ ARCHITECTURE REVIEW

**Positive Aspects:**
- HttpOnly cookie-based refresh tokens: correct approach, no token storage in localStorage for auth
- Session ID invalidation pattern: single active session enforcement is well-implemented
- Tenant isolation: multi-tenant scoping exists throughout most routes
- Role hierarchy: director > admin > subadmin > doctor > staff > patient is logically structured
- Subscription/tenant status checked on every auth request
- Password reset uses hashed token storage (not raw token in DB): correct
- Refresh token rotation on every use: correct

**Architectural Concerns:**
- The hardcoded director bypass fundamentally undermines the entire session/auth architecture
- No separation between access token and refresh token secrets weakens the token scheme
- Director "hardcoded-id" handling in the refresh endpoint creates an un-revocable super-session
- Firebase service account is used for DB while also being exposed — the entire data layer is compromised
- No API versioning (`/api/v1/`) makes future breaking changes difficult
- Missing request correlation IDs (trace IDs) for debugging distributed issues across Vercel + Render

---

## 🔐 SECURITY SCORE

| Category | Score | Notes |
|---|---|---|
| Authentication | 4/10 | Good JWT structure, destroyed by hardcoded backdoor |
| Authorization/RBAC | 6/10 | Role structure is solid, some routes missing |
| Data Protection | 2/10 | Private keys committed, uploads unprotected |
| Input Validation | 3/10 | No validation library, no sanitization |
| Security Headers | 5/10 | Helmet used but no CSP |
| Rate Limiting | 0/10 | Completely absent |
| Logging/Monitoring | 2/10 | Debug files committed, no structured logging |
| Secrets Management | 1/10 | All secrets committed to source |

### **Overall Security Score: 3/10**

---

## 🚀 PRODUCTION READINESS SCORE

| Category | Score | Notes |
|---|---|---|
| Authentication Flows | 4/10 | Auto-login after reset, temp passwords in email |
| Secret Handling | 1/10 | Credentials committed to repo |
| Performance | 4/10 | 1.3MB bundle, no code splitting |
| Error Handling | 5/10 | Global error handler exists, no error boundaries |
| Monitoring | 2/10 | Debug log files, no APM |
| RBAC Enforcement | 6/10 | Generally well-implemented |
| Data Privacy | 2/10 | Uploads publicly accessible |
| Scalability | 5/10 | Multi-tenant structure is reasonable |

### **Overall Production Readiness Score: 2/10**

---

## ⚖️ FINAL VERDICT

> ## ❌ NOT PRODUCTION-READY — Do Not Deploy

This system **must not be deployed** to handle real patient data in its current state. Here is a prioritized fix roadmap:

### Phase 1 — Immediate (Do Today)
1. Revoke and rotate the Firebase service account key
2. Rotate all secrets in `.env` (JWT, Razorpay, SMTP)
3. Remove the hardcoded `admin@gmail.com / admin@123` director bypass
4. Remove `service-account.json` and `.env` from git history
5. Take the live Vercel deployment offline until Phase 1 is complete

### Phase 2 — Before Any Testing with Real Data (1 Week)
6. Remove auto-login from password reset endpoint
7. Remove temporary passwords from emails (use setup links)
8. Add rate limiting to all auth endpoints
9. Protect the `/uploads` directory with authentication
10. Remove all debug files, utility scripts, and log files from the repo

### Phase 3 — Before Production Launch (2–4 Weeks)
11. Add input validation and mongo sanitization
12. Implement code splitting (reduce bundle to <300KB)
13. Add proper Content Security Policy
14. Add error boundaries to React frontend
15. Replace file-based logging with structured logging service
16. Shorten access token expiry to 15 minutes
17. Add audit logging for PHI access
18. Conduct penetration testing

---

*This report was generated by automated source analysis and manual code review. Live endpoint testing was not performed to avoid disrupting any active users.*
