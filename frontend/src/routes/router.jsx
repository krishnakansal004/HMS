import { createBrowserRouter, Navigate } from "react-router-dom";
import AppShell from "../components/layout/AppShell.jsx";
import ProtectedRoute from "./ProtectedRoute.jsx";
import Login from "../pages/auth/Login.jsx";
import Register from "../pages/auth/Register.jsx";
import Dashboard from "../pages/Dashboard.jsx";
import PatientsList from "../pages/patients/PatientsList.jsx";
import AppointmentsList from "../pages/appointments/AppointmentsList.jsx";
import ComingSoon from "../pages/ComingSoon.jsx";
import { NotFound, Unauthorized } from "../pages/StatusPages.jsx";
import { ROLES } from "../utils/roles.js";
import DoctorsList from "../pages/doctors/DoctorsList.jsx";
import PatientDetails from "../pages/patients/PatientDetails.jsx";
import WardsList from "../pages/wards/WardsList.jsx";
import ApplyDoctor from "../pages/public/ApplyDoctor.jsx";
import DoctorApplicationsList from "../pages/doctors/DoctorApplicationsList.jsx";
import DoctorDetails from "../pages/doctors/DoctorDetails.jsx";
import SetupPassword from "../pages/auth/SetupPassword.jsx";
import InventoryList from "../pages/inventory/InventoryList.jsx";
import AdmissionsList from "../pages/admissions/AdmissionsList.jsx";
import HrmsDashboard from "../pages/hrms/HrmsDashboard.jsx";
import SystemOwnerDashboard from '../pages/plans/SystemOwnerDashboard.jsx';
import TenantDetails from '../pages/plans/TenantDetails.jsx';
import InvoicesList from "../pages/invoices/InvoicesList.jsx";
import PrescriptionsList from "../pages/prescriptions/PrescriptionsList.jsx";
import PlansDashboard from "../pages/plans/PlansDashboard.jsx";
import LabOrdersList from "../pages/lab/LabOrdersList.jsx";
import RadiologyList from "../pages/radiology/RadiologyList.jsx";
import InsuranceList from "../pages/insurance/InsuranceList.jsx";
import PurchasesList from "../pages/purchases/PurchasesList.jsx";
import GenerateInvoicePage from "../pages/invoices/GenerateInvoicePage.jsx";
import CreatePurchasePage from "../pages/purchases/CreatePurchasePage.jsx";


// Modules below have a full API layer (src/api/) but no screen yet —
// see the phased build plan. Wiring the route now keeps nav links from
// dead-ending on a blank screen as each phase lands.
const roadmap = [
  // ["admissions", "Admissions", "Phase 2"],
  // Wards & Beds removed from roadmap and wired below
  // ["prescriptions", "Prescriptions", "Phase 4"],
  // ["lab", "Laboratory", "Phase 4"],
  // ["radiology", "Radiology", "Phase 4"],
  // ["inventory", "Pharmacy Inventory", "Phase 5"],
  ["purchases", "Purchases", "Phase 5"],
  // ["invoices", "Billing", "Phase 3"],
  ["insurance", "Insurance Claims", "Phase 3"],
  ["expenses", "Expenses", "Phase 5"],
  ["attendance", "Attendance", "Phase 6"],
  ["settings", "Settings", "Phase 6"],
  // ["plans", "Plans & Tenants", "Phase 6"],
];

export const router = createBrowserRouter([
  // PUBLIC / UNPROTECTED ROUTES
  { path: "/login", element: <Login /> },
  { path: "/register", element: <Register /> },
  { path: "/apply/:hospitalSlug", element: <ApplyDoctor /> },
  { path: "/portal/:hospitalSlug/setup-password", element: <SetupPassword /> },
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
          <ProtectedRoute roles={[ROLES.HOSPITAL_ADMIN, ROLES.ACCOUNTANT, ROLES.CASHIER, ROLES.RECEPTIONIST, ROLES.DOCTOR]}>
            <InvoicesList />
          </ProtectedRoute>
        ),
        handle: { title: "Billing" },
      },
      {
        path: "invoices/new",
        element: (
          <ProtectedRoute roles={[ROLES.HOSPITAL_ADMIN, ROLES.ACCOUNTANT, ROLES.CASHIER, ROLES.RECEPTIONIST, ROLES.DOCTOR]}>
            <GenerateInvoicePage />
          </ProtectedRoute>
        ),
        handle: { title: "Generate Invoice" },
      },
      {
        path: "prescriptions",
        element: (
          <ProtectedRoute roles={[ROLES.HOSPITAL_ADMIN, ROLES.DOCTOR, ROLES.PHARMACIST, ROLES.NURSE]}>
            <PrescriptionsList />
          </ProtectedRoute>
        ),
        handle: { title: "Prescriptions" },
      },
      {
        path: "lab",
        element: (
          <ProtectedRoute roles={[ROLES.HOSPITAL_ADMIN, ROLES.DOCTOR, ROLES.LAB_TECHNICIAN, ROLES.RECEPTIONIST]}>
            <LabOrdersList />
          </ProtectedRoute>
        ),
        handle: { title: "Laboratory" },
      },
      {
        path: "radiology",
        element: (
          <ProtectedRoute roles={[ROLES.HOSPITAL_ADMIN, ROLES.DOCTOR, ROLES.RADIOLOGY_TECHNICIAN, ROLES.RECEPTIONIST]}>
            <RadiologyList />
          </ProtectedRoute>
        ),
        handle: { title: "Radiology" },
      },
      {
        path: "insurance",
        element: (
          <ProtectedRoute roles={[ROLES.HOSPITAL_ADMIN, ROLES.ACCOUNTANT, ROLES.RECEPTIONIST, ROLES.DOCTOR]}>
            <InsuranceList />
          </ProtectedRoute>
        ),
        handle: { title: "Insurance Claims" },
      },
      {
        path: "purchases",
        element: (
          <ProtectedRoute roles={[ROLES.HOSPITAL_ADMIN, ROLES.STORE_MANAGER, ROLES.ACCOUNTANT]}>
            <PurchasesList />
          </ProtectedRoute>
        ),
        handle: { title: "Purchases" },
      },
      {
        path: "purchases/new",
        element: (
          <ProtectedRoute roles={[ROLES.HOSPITAL_ADMIN, ROLES.STORE_MANAGER, ROLES.ACCOUNTANT]}>
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
