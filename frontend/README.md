# PharmaPlus HMS Frontend

This is the frontend for PharmaPlus HMS built with React and Vite.

## Authentication

The app now uses JWT-based authentication against the backend.

### Flow
1. User visits `/login` and submits email + password.
2. On success the backend returns `{ token, user }`.
3. Token is stored in `localStorage` and attached to all API calls as `Authorization: Bearer <token>`.
4. Protected routes are wrapped by `RequireAuth` which redirects unauthenticated users to `/login`.

### Files
- `src/context/AuthContext.jsx` manages auth state, bootstrap, login/logout.
- `src/components/RequireAuth.jsx` guards routes and shows loading state.
- `src/pages/Login.jsx` login form.
- `src/services/api.js` auth-aware fetch helper.

### Usage
To add a new protected page just add it under the protected route array in `router.jsx`.

### Development
Backend runs on `http://localhost:4000` (see backend README). Ensure `VITE_API_URL` env var matches if you change ports.

## Env
You can set `VITE_API_URL` via a `.env` file in the frontend root for local development.

Deployment notes (Vercel):
- Do NOT commit a production backend URL in `frontend/.env` — builds bake env values at build-time.
- In Vercel, go to your project Settings → Environment Variables and add `VITE_API_URL` with your backend URL (for example `https://your-backend.onrender.com`).
- If you want to accept multiple frontend origins in the backend, set `CORS_ORIGIN` on the backend (Render) to a comma-separated list, e.g. `https://your-vercel-app.vercel.app,https://staging.vercel.app` or use `*.vercel.app` for wildcard subdomains.
# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

## Doctor Dashboard (Clinical Panel)

The doctor role now sees a dedicated dashboard (`DoctorDashboard.jsx`) instead of the generic inventory/sales view.

### Backend Metrics Endpoint
- `GET /api/reports/doctor-dashboard` (auth required, doctor/admin) returns:
	- `counts.todayAppointments`
	- `counts.next7Appointments`
	- `counts.patientsSeen30d`
	- `counts.pendingPrescriptions`
	- `counts.prescriptionsIssuedToday`
	- `counts.queueWaiting`
	- `upcoming[]` (first 10 upcoming appointments)
	- `pendingPrescriptions[]` (latest pending approvals)
	- `queue[]` (waiting tokens for today)

### Frontend Features
- Metric cards for quick situational awareness.
- Upcoming appointments list with patient names + tokens.
- Pending prescriptions panel.
- Responsibilities section (patient care, documentation, stewardship, prevention, collaboration, ethics).
- Global health snapshot (high-level trends; not real-time WHO data).
- Inspirational image gallery using royalty-free Unsplash images (alt text included).

### Extending
Enhance KPIs by editing aggregation logic in `backend/src/routes/reports.js` (doctor-dashboard route). Possible additions: average wait time, completed vs scheduled ratio, prescription turnaround time.

