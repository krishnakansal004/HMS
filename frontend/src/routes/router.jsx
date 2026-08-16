import { createBrowserRouter, Navigate } from 'react-router-dom';
import AppShell from '../components/layout/AppShell.jsx';
import ProtectedRoute from './ProtectedRoute.jsx';
import Login from '../pages/auth/Login.jsx';
import Register from '../pages/auth/Register.jsx';
import Dashboard from '../pages/Dashboard.jsx';
import PatientsList from '../pages/patients/PatientsList.jsx';
import AppointmentsList from '../pages/appointments/AppointmentsList.jsx';
import ComingSoon from '../pages/ComingSoon.jsx';
import { NotFound, Unauthorized } from '../pages/StatusPages.jsx';
import { ROLES } from '../utils/roles.js';

// Modules below have a full API layer (src/api/) but no screen yet —
// see the phased build plan. Wiring the route now keeps nav links from
// dead-ending on a blank screen as each phase lands.
const roadmap = [
  ['admissions', 'Admissions', 'Phase 2'],
  ['wards', 'Wards & Beds', 'Phase 2'],
  ['prescriptions', 'Prescriptions', 'Phase 4'],
  ['lab', 'Laboratory', 'Phase 4'],
  ['radiology', 'Radiology', 'Phase 4'],
  ['inventory', 'Pharmacy Inventory', 'Phase 5'],
  ['purchases', 'Purchases', 'Phase 5'],
  ['invoices', 'Billing', 'Phase 3'],
  ['insurance', 'Insurance Claims', 'Phase 3'],
  ['expenses', 'Expenses', 'Phase 5'],
  ['attendance', 'Attendance', 'Phase 6'],
  ['settings', 'Settings', 'Phase 6'],
  ['plans', 'Plans & Tenants', 'Phase 6'],
];

export const router = createBrowserRouter([
  { path: '/login', element: <Login /> },
  { path: '/register', element: <Register /> },
  { path: '/unauthorized', element: <Unauthorized /> },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <AppShell />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard', element: <Dashboard />, handle: { title: 'Dashboard' } },
      {
        path: 'patients',
        element: (
          <ProtectedRoute roles={[ROLES.HOSPITAL_ADMIN, ROLES.RECEPTIONIST, ROLES.DOCTOR, ROLES.NURSE]}>
            <PatientsList />
          </ProtectedRoute>
        ),
        handle: { title: 'Patients' },
      },
      {
        path: 'appointments',
        element: (
          <ProtectedRoute roles={[ROLES.HOSPITAL_ADMIN, ROLES.RECEPTIONIST, ROLES.DOCTOR, ROLES.PATIENT]}>
            <AppointmentsList />
          </ProtectedRoute>
        ),
        handle: { title: 'Appointments' },
      },
      ...roadmap.map(([path, title, phase]) => ({
        path,
        element: <ComingSoon moduleName={title} phase={phase} />,
        handle: { title },
      })),
    ],
  },
  { path: '*', element: <NotFound /> },
]);
