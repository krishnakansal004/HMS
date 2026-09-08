import { createBrowserRouter, Navigate } from "react-router-dom";
import { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";

// Eager Imports Path - Loads Instantly
import AppShell from "../components/layout/AppShell.jsx";
import ProtectedRoute from "./ProtectedRoute.jsx";
import Login from "../pages/auth/Login.jsx";
import Register from "../pages/auth/Register.jsx";
import Dashboard from "../pages/Dashboard.jsx";
import ComingSoon from "../pages/ComingSoon.jsx";
import { NotFound, Unauthorized } from "../pages/StatusPages.jsx";
import { ROLES } from "../utils/roles.js";

// Lazy Imports - Code Split
const PatientsList = lazy(
  () => import("../pages/patients/PatientsList.jsx")
);
const AppointmentsList = lazy(
  () => import("../pages/appointments/AppointmentsList.jsx"),
);
const DoctorsList = lazy(
  () => import("../pages/doctors/DoctorsList.jsx")
);
const PatientDetails = lazy(
  () => import("../pages/patients/PatientDetails.jsx"),
);
const WardsList = lazy(
  () => import("../pages/wards/WardsList.jsx")
);
const ApplyDoctor = lazy(
  () => import("../pages/public/ApplyDoctor.jsx")
);
const DoctorApplicationsList = lazy(
  () => import("../pages/doctors/DoctorApplicationsList.jsx"),
);
const DoctorDetails = lazy(
  () => import("../pages/doctors/DoctorDetails.jsx")
);
const SetupPassword = lazy(
  () => import("../pages/auth/SetupPassword.jsx")
);
const InventoryList = lazy(
  () => import("../pages/inventory/InventoryList.jsx"),
);
const AdmissionsList = lazy(
  () => import("../pages/admissions/AdmissionsList.jsx"),
);
const HrmsDashboard = lazy(
  () => import("../pages/hrms/HrmsDashboard.jsx")
);
const SystemOwnerDashboard = lazy(
  () => import("../pages/plans/SystemOwnerDashboard.jsx"),
);
const TenantDetails = lazy(
  () => import("../pages/plans/TenantDetails.jsx")
);
const InvoicesList = lazy(
  () => import("../pages/invoices/InvoicesList.jsx")
);
const PrescriptionsList = lazy(
  () => import("../pages/prescriptions/PrescriptionsList.jsx"),
);
const PlansDashboard = lazy(
  () => import("../pages/plans/PlansDashboard.jsx")
);
const LabOrdersList = lazy(
  () => import("../pages/lab/LabOrdersList.jsx")
);
const RadiologyList = lazy(
  () => import("../pages/radiology/RadiologyList.jsx"),
);
const InsuranceList = lazy(
  () => import("../pages/insurance/InsuranceList.jsx"),
);
const PurchasesList = lazy(
  () => import("../pages/purchases/PurchasesList.jsx"),
);
const GenerateInvoicePage = lazy(
  () => import("../pages/invoices/GenerateInvoicePage.jsx"),
);
const CreatePurchasePage = lazy(
  () => import("../pages/purchases/CreatePurchasePage.jsx"),
);
const DoctorAttendanceBoard = lazy(
  () => import("../pages/doctors/DoctorAttendanceBoard.jsx"),
);
const AttendanceBoard = lazy(
  () => import("../pages/hrms/AttendanceBoard.jsx")
);

// Universal loader for public lazy routes
const FullPageLoader = () => (
  <div className="flex min-h-screen items-center justify-center bg-[var(--color-paper)]">
    <Loader2 className="animate-spin text-[var(--color-ink-faint)]" size={24} />
  </div>
);

const roadmap = [
  ["purchases", "Purchases", "Phase 5"],
  ["insurance", "Insurance Claims", "Phase 3"],
  ["expenses", "Expenses", "Phase 5"],
  // ["attendance", "Attendance", "Phase 6"],
  ["settings", "Settings", "Phase 6"],
];

export const router = createBrowserRouter([
  // PUBLIC / UNPROTECTED ROUTES
  { path: "/login", element: <Login /> },
  { path: "/register", element: <Register /> },
  {
    path: "/apply/:hospitalSlug",
    element: (
      <Suspense fallback={<FullPageLoader />}>
        <ApplyDoctor />
      </Suspense>
    ),
  },
  {
    path: "/portal/:hospitalSlug/setup-password",
    element: (
      <Suspense fallback={<FullPageLoader />}>
        <SetupPassword />
      </Suspense>
    ),
  },
  { path: "/unauthorized", element: <Unauthorized /> },

  // PROTECTED ROUTES
  {
    path: "/",
    element: (
      <ProtectedRoute>
        <AppShell />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      {
        path: "dashboard",
        element: <Dashboard />,
        handle: { title: "Dashboard" },
      },
      {
        path: "patients",
        element: (
          <ProtectedRoute
            roles={[
              ROLES.HOSPITAL_ADMIN,
              ROLES.RECEPTIONIST,
              ROLES.DOCTOR,
              ROLES.NURSE,
            ]}
          >
            <PatientsList />
          </ProtectedRoute>
        ),
        handle: { title: "Patients" },
      },
      {
        path: "patients/:id",
        element: (
          <ProtectedRoute
            roles={[
              ROLES.HOSPITAL_ADMIN,
              ROLES.RECEPTIONIST,
              ROLES.DOCTOR,
              ROLES.NURSE,
            ]}
          >
            <PatientDetails />
          </ProtectedRoute>
        ),
        handle: { title: "Patient Profile" },
      },
      {
        path: "wards",
        element: (
          <ProtectedRoute
            roles={[
              ROLES.HOSPITAL_ADMIN,
              ROLES.NURSE,
              ROLES.RECEPTIONIST,
              ROLES.DOCTOR,
            ]}
          >
            <WardsList />
          </ProtectedRoute>
        ),
        handle: { title: "Wards & Beds" },
      },
      {
        path: "appointments",
        element: (
          <ProtectedRoute
            roles={[
              ROLES.HOSPITAL_ADMIN,
              ROLES.RECEPTIONIST,
              ROLES.DOCTOR,
              ROLES.PATIENT,
            ]}
          >
            <AppointmentsList />
          </ProtectedRoute>
        ),
        handle: { title: "Appointments" },
      },
      {
        path: "doctors",
        element: (
          <ProtectedRoute roles={[ROLES.HOSPITAL_ADMIN, ROLES.DIRECTOR]}>
            <DoctorsList />
          </ProtectedRoute>
        ),
        handle: { title: "Medical Staff" },
      },
      {
        path: "doctors/:id",
        element: (
          <ProtectedRoute roles={[ROLES.HOSPITAL_ADMIN, ROLES.DIRECTOR]}>
            <DoctorDetails />
          </ProtectedRoute>
        ),
        handle: { title: "Doctor Profile" },
      },
      {
        path: "doctor-applications",
        element: (
          <ProtectedRoute roles={[ROLES.HOSPITAL_ADMIN, ROLES.DIRECTOR]}>
            <DoctorApplicationsList />
          </ProtectedRoute>
        ),
        handle: { title: "Review Applicant" },
      },
      {
        path: "inventory",
        element: (
          <ProtectedRoute
            roles={[
              ROLES.HOSPITAL_ADMIN,
              ROLES.PHARMACIST,
              ROLES.STORE_MANAGER,
              ROLES.NURSE,
              ROLES.DOCTOR,
            ]}
          >
            <InventoryList />
          </ProtectedRoute>
        ),
        handle: { title: "Pharmacy Inventory" },
      },
      {
        path: "admissions",
        element: (
          <ProtectedRoute
            roles={[
              ROLES.HOSPITAL_ADMIN,
              ROLES.DOCTOR,
              ROLES.NURSE,
              ROLES.RECEPTIONIST,
            ]}
          >
            <AdmissionsList />
          </ProtectedRoute>
        ),
        handle: { title: "Admissions" },
      },
      {
        path: "hrms",
        element: (
          <ProtectedRoute
            roles={[ROLES.HOSPITAL_ADMIN, ROLES.HR, ROLES.DIRECTOR]}
          >
            <HrmsDashboard />
          </ProtectedRoute>
        ),
        handle: { title: "HRMS & Staff" },
      },
      {
        path: "attendance",
        element: (
          <ProtectedRoute roles={[ROLES.HOSPITAL_ADMIN, ROLES.HR, ROLES.DOCTOR, ROLES.NURSE, ROLES.RECEPTIONIST, ROLES.PHARMACIST, ROLES.LAB_TECHNICIAN]}>
            <AttendanceBoard />
          </ProtectedRoute>
        ),
        handle: { title: "Staff Attendance" },
      },
      {
        path: "doctor-attendance",
        element: (
          <ProtectedRoute
            roles={[
              ROLES.HOSPITAL_ADMIN,
              ROLES.HR,
              ROLES.DIRECTOR,
              ROLES.DOCTOR,
            ]}
          >
            <DoctorAttendanceBoard />
          </ProtectedRoute>
        ),
        handle: { title: "Doctor Attendance" },
      },
      {
        path: "plans",
        element: (
          <ProtectedRoute roles={[ROLES.SYSTEM_OWNER, ROLES.DIRECTOR]}>
            <SystemOwnerDashboard />
            <PlansDashboard />
          </ProtectedRoute>
        ),
        handle: { title: "Plans & Tenants" },
      },
      {
        path: "tenants/:id",
        element: (
          <ProtectedRoute roles={[ROLES.SYSTEM_OWNER, ROLES.DIRECTOR]}>
            <TenantDetails />
          </ProtectedRoute>
        ),
        handle: { title: "Tenant Profile" },
      },
      {
        path: "invoices",
        element: (
          <ProtectedRoute
            roles={[
              ROLES.HOSPITAL_ADMIN,
              ROLES.ACCOUNTANT,
              ROLES.CASHIER,
              ROLES.RECEPTIONIST,
              ROLES.DOCTOR,
            ]}
          >
            <InvoicesList />
          </ProtectedRoute>
        ),
        handle: { title: "Billing" },
      },
      {
        path: "invoices/new",
        element: (
          <ProtectedRoute
            roles={[
              ROLES.HOSPITAL_ADMIN,
              ROLES.ACCOUNTANT,
              ROLES.CASHIER,
              ROLES.RECEPTIONIST,
              ROLES.DOCTOR,
            ]}
          >
            <GenerateInvoicePage />
          </ProtectedRoute>
        ),
        handle: { title: "Generate Invoice" },
      },
      {
        path: "prescriptions",
        element: (
          <ProtectedRoute
            roles={[
              ROLES.HOSPITAL_ADMIN,
              ROLES.DOCTOR,
              ROLES.PHARMACIST,
              ROLES.NURSE,
            ]}
          >
            <PrescriptionsList />
          </ProtectedRoute>
        ),
        handle: { title: "Prescriptions" },
      },
      {
        path: "lab",
        element: (
          <ProtectedRoute
            roles={[
              ROLES.HOSPITAL_ADMIN,
              ROLES.DOCTOR,
              ROLES.LAB_TECHNICIAN,
              ROLES.RECEPTIONIST,
            ]}
          >
            <LabOrdersList />
          </ProtectedRoute>
        ),
        handle: { title: "Laboratory" },
      },
      {
        path: "radiology",
        element: (
          <ProtectedRoute
            roles={[
              ROLES.HOSPITAL_ADMIN,
              ROLES.DOCTOR,
              ROLES.RADIOLOGY_TECHNICIAN,
              ROLES.RECEPTIONIST,
            ]}
          >
            <RadiologyList />
          </ProtectedRoute>
        ),
        handle: { title: "Radiology" },
      },
      {
        path: "insurance",
        element: (
          <ProtectedRoute
            roles={[
              ROLES.HOSPITAL_ADMIN,
              ROLES.ACCOUNTANT,
              ROLES.RECEPTIONIST,
              ROLES.DOCTOR,
            ]}
          >
            <InsuranceList />
          </ProtectedRoute>
        ),
        handle: { title: "Insurance Claims" },
      },
      {
        path: "purchases",
        element: (
          <ProtectedRoute
            roles={[
              ROLES.HOSPITAL_ADMIN,
              ROLES.STORE_MANAGER,
              ROLES.ACCOUNTANT,
            ]}
          >
            <PurchasesList />
          </ProtectedRoute>
        ),
        handle: { title: "Purchases" },
      },
      {
        path: "purchases/new",
        element: (
          <ProtectedRoute
            roles={[
              ROLES.HOSPITAL_ADMIN,
              ROLES.STORE_MANAGER,
              ROLES.ACCOUNTANT,
            ]}
          >
            <CreatePurchasePage />
          </ProtectedRoute>
        ),
        handle: { title: "Create Purchase Order" },
      },

      ...roadmap.map(([path, title, phase]) => ({
        path,
        element: <ComingSoon moduleName={title} phase={phase} />,
        handle: { title },
      })),
    ],
  },
  { path: "*", element: <NotFound /> },
]);
