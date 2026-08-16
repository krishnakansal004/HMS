# HMS Frontend v2 — "Clinical Ledger"

A clean-room rebuild of the HMS frontend, wired only to the **live**
Postgres/Prisma-backed API (19 route groups mounted in `backend/src/app.js`),
not the legacy 47-route Firestore surface the current `frontend/` targets.

## Setup

```bash
cd frontend-v2
npm install
cp .env.example .env   # point VITE_BACKEND_ORIGIN at your running backend
npm run dev
```

Build was verified locally: `npm run build` compiles cleanly (1607 modules,
no errors) as of this handoff.

## Demo walkthrough

1. **Register** a patient account (or log in as an existing staff user) —
   note the hospital ID field; every non-System-Owner login needs it.
2. **Dashboard** — live patient/appointment counts, role-aware quick links.
3. **Patients** — search, register a new patient (try filling in allergies
   and medical history — that's the bug fixed this session), edit one.
4. **Appointments** — filter by status, book one, change its status inline.
5. To show session resilience: leave the tab open past 15 minutes (the
   access token's lifetime) or just hard-refresh the page — you'll stay
   logged in either way now, silently, via the refresh-token fix.
6. Any other sidebar item (Admissions, Billing, Lab, …) shows an
   intentional "coming soon" card naming its phase — not a dead link or
   an error, safe to click during a walkthrough.

## What's built (Phase 0 + 1)

- **Design system** (`src/index.css`) — deliberately not the generic
  blue-600/indigo the old frontend used. Deep teal primary, warm gold
  accent, a repeating status-dot/pill language (`StatusPill.jsx`) that's
  the one visual idiom tying every module together.
- **Full API client** (`src/api/`) — one file per live module, every
  function mapped directly to the actual route + validator in the backend,
  not guessed. Read the comments at the top of each file before wiring a
  new screen against it; several call out real constraints (money-as-paise
  on invoices, 7-entry `days` array on availability, etc.).
- **Auth** — login, register (patient self-signup only — there's no public
  staff registration route), logout. Token is held in memory only, never
  localStorage, matching the project's existing security decision.
- **Role-aware shell** — sidebar nav filtered by role (`utils/navConfig.js`,
  built from the actual `requireRoles(...)` calls per route file), topbar,
  protected routing.
- **Dashboard** — pulls real counts from `/patients` and `/appointments`
  rather than a stats endpoint, because no `/api/dashboard` exists among
  the 19 live route groups.
- **Patients module** — full CRUD-minus-delete: search, paginate, register,
  edit. This is the quality template for the rest.
- **Appointments module** — list with status filter, book, inline status
  transitions.
- Every other live module (admissions, wards, prescriptions, lab,
  radiology, inventory, purchases, invoices, insurance, expenses,
  attendance, settings, plans/tenants) has its **API layer done** but no
  screen yet — hitting one of these nav items shows a "coming soon" card
  naming the phase it's scheduled for, instead of a dead link.
- **Session survives a page reload.** `App.jsx` calls `authStore.bootstrap()`
  once on load, which silently exchanges the httpOnly refresh cookie for a
  fresh access token via `/api/auth/refresh` (see "Fixed backend gaps" #3)
  before the router ever renders — a demo laptop sleeping, a tab reload, or
  a token expiring mid-walkthrough no longer bounces anyone to `/login`.

## Fixed backend gaps

1. **`POST /api/tenants/provision`** had no auth middleware, and (the real
   hole) `provisionHospitalTenant()` accepted any active `planId` including
   private/customized ones — anyone could self-provision a paid tier for
   free. Fixed: rate limiting added (`tenantProvisionLimiter`, 5/hour/IP),
   and the service now rejects any plan where `!plan.public || plan.customized`.
   The public plan listing (`GET /api/plans`) was also silently leaking
   private plan IDs — `findActivePlans()` now filters `public: true`.
   Endpoint deliberately kept unauthenticated (it's self-serve signup by
   design). See `backend/src/{middlewares/rateLimiters.js,
   routes/tenants.js, services/tenantPlanService.js,
   repositories/tenantPlanRepository.js}`.

2. **`PUT /api/patients/:id` 500 on `allergies`/`medicalHistory`/
   `emergencyContact`** — migration `0041_add_patient_clinical_fields.sql`
   adds the three missing columns, `schema.prisma` and
   `patientService.registerPatient()` are updated to match (the create
   path was also silently dropping these fields before — not just the
   edit path 500ing). The patient form here now exposes all three fields
   on both create and edit.

   **Bonus find while in that file:** `migrateSQL/0012_create_patient_table.sql`
   had a missing comma between the `fk_patient_bed` and `uk_tenant_phone`
   constraints — a syntax error that would fail a fresh `CREATE TABLE`
   run from scratch. Fixed in the same pass.

   **Action needed on your end:** run `npx prisma generate` after applying
   migration 0041 — this sandbox can't reach `binaries.prisma.sh` to run
   `prisma validate`/`generate` itself, so the schema edit was checked
   manually (brace-balanced, no duplicate fields, matches the `address`
   field's existing type convention) but not engine-validated.

3. **`POST /api/auth/refresh` now exists.** `AuthService.refresh()` verifies
   the httpOnly refresh cookie, re-runs the same tenant-active/user-deleted
   checks `login()` does (a stale-but-unexpired refresh token shouldn't
   outlive a tenant getting suspended after it was issued), and returns a
   fresh access token. Deliberately does **not** rotate the refresh token
   itself — real rotation needs a revocation/reuse-detection store this
   schema doesn't have yet; noted as a future hardening step, not done here.
   The frontend now uses this both for silent mid-session renewal and to
   restore a session on page load (see above). See
   `backend/src/{services/authService.js, controllers/authController.js,
   routes/auth.js}`.

   **Two related fixes made while in `authService.js`:** `login()` never
   checked `deleted_at` on the user, so a soft-deleted/offboarded staff
   account could still log in indefinitely — added the same check to both
   `login()` and the new `refresh()`. Also added `tenantName` to the user
   object returned by both (only `tenantSlug` was there before) — the
   sidebar here shows the hospital's actual name, not its slug.

4. **CSRF, right-sized for this app's actual architecture.** Every
   data-mutating route already authenticates via a Bearer token in the
   `Authorization` header, which a forged cross-site request can't set —
   not CSRF-exploitable regardless of middleware. Only `login`, `logout`,
   and `refresh` touch a cookie. Added `requireCsrfHeader` (checks for
   `X-Requested-With: XMLHttpRequest`, which a forged cross-site form/img
   request can't set) to exactly those three. This closes a real
   login-CSRF gap: `sameSite` stops the refresh cookie being *sent*
   cross-site later, but doesn't stop it being *set* by a cross-site POST
   response — without this, a forged login with attacker-controlled
   credentials could plant the *attacker's* session cookie in a victim's
   browser, which this app's own silent-session-restore-on-load feature
   would then pick up. See `backend/src/middlewares/csrfMiddleware.js`.

   **Related fix in the same pass:** `app.js`'s CORS config fell back to
   `origin: '*'`, invalid alongside `credentials: true` — would have
   silently broken production credentialed requests rather than openly
   exposing anything. `config/env.js` now fails loudly at startup if
   `ALLOWED_ORIGINS` is missing in production.

5. **Appointments module — severe bug cluster, found via a full migration
   dry-run + CHECK-constraint audit, all fixed and empirically verified.**
   Status/type values were uppercase throughout the Node.js layer while
   the database only ever accepted lowercase — confirmed 6-for-6 failing
   directly against a live Postgres instance. Worse, found while tracing
   why: `AppointmentRepository.findByIdAndTenant()` was being called with
   its two arguments swapped, meaning every status-update request 404'd
   regardless of the casing issue — proved this by running the same query
   both ways against the same row. `type` and `reason` were validated but
   had no column to persist to at all. All fixed: migration `0042`,
   `schema.prisma`, `appointmentValidator.js`, `appointmentService.js`,
   `appointmentRepository.js`, and this frontend's `api/appointments.js`,
   `AppointmentForm.jsx`, `StatusPill.jsx`. Full trace in
   `HMS_ROADMAP.md`, section A3 — including five more modules with the
   same casing-mismatch pattern in their validators, not yet live-broken
   since their screens aren't built, but needing the same check before
   Phases 3–6.

## Known backend gaps (deliberately not fixed this pass — see reasoning)

4. **CSRF protection isn't just "disabled," it doesn't exist.** The
   commented-out import in the old `auth.js` pointed at
   `middlewares/csrfMiddleware.js`, which isn't in this codebase — it would
   need to be built from scratch (double-submit cookie pattern, a
   `/api/auth/csrf` endpoint, applied across state-changing routes), then
   the frontend would need to fetch and attach that token on every mutating
   request. That's new cross-cutting infrastructure touching all 19
   modules, not a bug fix — building it half-coordinated right before a
   demo risks breaking every login/save in the room. Recommend as its own
   dedicated task.

5. **The `requireRoles('director')` casing bug is a symptom, not the
   problem.** It lives in `routes/directorAdmins.js` and
   `routes/directorStats.js`, importing from `utils/auth.js` — **none of
   which are mounted in `app.js`**, so this doesn't affect anything live
   today. More importantly, `utils/auth.js`'s other role checks
   (`'admin'`, `'subadmin'`, `'staff'`) reference roles that don't exist
   in your current 14-role schema at all — this is a leftover from an
   earlier auth model, not a one-line casing fix. Uppercasing just
   `'director'` would look fixed without being correct. Needs a real
   audit against the current role list when these routes actually get
   migrated, not a patch now.

6. **Request/response casing is asymmetric.** Request bodies are
   camelCase; responses are raw Prisma rows in snake_case
   (`first_name`, `patient_id`, `date_of_birth`, …). Not fixed on purpose:
   every page in this frontend was written against snake_case responses,
   so a backend-side camelCase transform would need a coordinated frontend
   rewrite in the same pass — real risk right before a demo, and it's a
   convention, not a crash. Worth deciding deliberately later, not
   bolting on now.
7. `expenseValidator.js`'s `category` allowlist is now confirmed: `SALARY`,
   `MAINTENANCE`, `UTILITIES`, `EQUIPMENT`, `MEDICINE_PURCHASE`,
   `MARKETING`, `RENT`, `MISCELLANEOUS` (`src/api/expenses.js` exports
   `EXPENSE_CATEGORIES`).

## Build plan for what's left

| Phase | Scope |
|---|---|
| 2 | Admissions, Wards/Beds, Availability |
| 3 | Invoices, Insurance, Payments |
| 4 | Lab, Radiology, Prescriptions |
| 5 | Inventory, Purchases, Expenses |
| 6 | Settings, Plans, Tenants, Plan Requests, Attendance |

Each phase follows the pattern set by Patients/Appointments: read the
route + validator + Prisma model first, build the API functions (already
done for all 19), then the screen.
