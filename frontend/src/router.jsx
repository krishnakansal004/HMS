import { lazy, Suspense } from 'react'
import { createBrowserRouter, Outlet, Navigate, useParams } from 'react-router-dom'
import RequireAuth, { RoleGuard } from './components/RequireAuth'
import RequireDirectorAuth from './components/RequireDirectorAuth'
import PublicLayout from './components/PublicLayout'
import { RouteErrorBoundary } from './components/common/ErrorBoundary'

// Lazy load pages
const Home = lazy(() => import('./pages/Home'))
const About = lazy(() => import('./pages/About'))
const Features = lazy(() => import('./pages/Features'))
const Contact = lazy(() => import('./pages/Contact'))
const Login = lazy(() => import('./pages/Login'))
const Signup = lazy(() => import('./pages/Signup'))
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'))
const ResetPassword = lazy(() => import('./pages/ResetPassword'))
const ChangePassword = lazy(() => import('./pages/ChangePassword'))
const RoleBasedDashboard = lazy(() => import('./pages/RoleBasedDashboard'))
const HospitalLanding = lazy(() => import('./pages/HospitalLanding'))
const DirectorDashboard = lazy(() => import('./pages/DirectorDashboard'))
const DashboardPage = lazy(() => import('./pages/director/DashboardPage'))
const AdminsPage = lazy(() => import('./pages/director/AdminsPage'))
const UsersPage = lazy(() => import('./pages/director/UsersPage'))
const PlansPage = lazy(() => import('./pages/director/PlansPage'))
const FeaturesPage = lazy(() => import('./pages/director/FeaturesPage'))
const AnalyticsPage = lazy(() => import('./pages/director/AnalyticsPage'))
const PlansUsagePage = lazy(() => import('./pages/director/PlansUsagePage'))
const QueryForPlans = lazy(() => import('./pages/director/QueryForPlans'))
const ReceiptsPage = lazy(() => import('./pages/director/ReceiptsPage'))
const ExpensesPage = lazy(() => import('./pages/director/ExpensesPage'))
const PayInvoice = lazy(() => import('./pages/PayInvoice'))
const CustomizationRequests = lazy(() => import('./pages/director/CustomizationRequests'))
const SettingsPage = lazy(() => import('./pages/director/SettingsPage'))
const Inventory = lazy(() => import('./pages/Inventory'))
const Billing = lazy(() => import('./pages/Billing'))
const Purchases = lazy(() => import('./pages/Purchases'))
const Reports = lazy(() => import('./pages/Reports'))
const Invoice = lazy(() => import('./pages/Invoice'))
const BillManager = lazy(() => import('./pages/BillManager'))
const Appointments = lazy(() => import('./pages/Appointments'))
const DoctorAvailability = lazy(() => import('./pages/DoctorAvailability'))
const Doctors = lazy(() => import('./pages/Doctors'))
const MyAppointments = lazy(() => import('./pages/MyAppointments'))
const MyProfile = lazy(() => import('./pages/MyProfile'))
const WaitingRoom = lazy(() => import('./pages/WaitingRoom'))
const VirtualRoom = lazy(() => import('./pages/VirtualRoom'))
const Staff = lazy(() => import('./pages/Staff'))
const Wards = lazy(() => import('./pages/Wards'))
const Patients = lazy(() => import('./pages/Patients'))
const PatientProfile = lazy(() => import('./pages/PatientProfile'))
const Shifts = lazy(() => import('./pages/Shifts'))
const FindDoctors = lazy(() => import('./pages/FindDoctors'))
const DoctorApply = lazy(() => import('./pages/DoctorApply'))
const DoctorApprovals = lazy(() => import('./pages/DoctorApprovals'))
const FaqsAdmin = lazy(() => import('./pages/FaqsAdmin'))
const PrescriptionTemplates = lazy(() => import('./pages/PrescriptionTemplates'))
const DoctorAttendance = lazy(() => import('./pages/DoctorAttendance'))
const DoctorAttendanceAdmin = lazy(() => import('./pages/DoctorAttendanceAdmin'))
const DoctorPatients = lazy(() => import('./pages/DoctorPatients'))
const DoctorPrescriptions = lazy(() => import('./pages/DoctorPrescriptions'))
const Attendance = lazy(() => import('./pages/Attendance'))
const LeaveRequests = lazy(() => import('./pages/LeaveRequests'))
const WardsLive = lazy(() => import('./pages/WardsLive'))
const Prescriptions = lazy(() => import('./pages/Prescriptions'))
const MyBilling = lazy(() => import('./pages/MyBilling'))
const MyReports = lazy(() => import('./pages/MyReports'))
const MyReceipts = lazy(() => import('./pages/MyReceipts'))
const Queries = lazy(() => import('./pages/Queries'))
const SubadminFeature = lazy(() => import('./pages/SubadminFeature'))
const MedicineStore = lazy(() => import('./pages/MedicineStore'))
const Laboratory = lazy(() => import('./pages/Laboratory'))
const Radiology = lazy(() => import('./pages/Radiology'))
const Insurance = lazy(() => import('./pages/Insurance'))
const OTManagement = lazy(() => import('./pages/OTManagement'))
const BloodBank = lazy(() => import('./pages/BloodBank'))
const Ambulance = lazy(() => import('./pages/Ambulance'))
const HRMS = lazy(() => import('./pages/HRMS'))
const AbdmIntegration = lazy(() => import('./pages/AbdmIntegration'))
const Telemedicine = lazy(() => import('./pages/Telemedicine'))
const Analytics = lazy(() => import('./pages/Analytics'))

function LegacyRedirect() {
    const { slug } = useParams()
    return <Navigate to={`/portal/${slug}`} replace />
}

const PageLoader = () => (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
            <p className="text-slate-500 font-medium animate-pulse">Loading...</p>
        </div>
    </div>
)

const withSuspense = (Component) => (
    <Suspense fallback={<PageLoader />}>
        <Component />
    </Suspense>
)

export const router = createBrowserRouter([
    {
        element: <Outlet />,
        ErrorBoundary: RouteErrorBoundary,
        children: [
            { path: '/login', element: withSuspense(Login) },
            { path: '/director/login', element: withSuspense(() => <Login directorOnly={true} />) },
            { path: '/signup', element: withSuspense(Signup) },
            { path: '/forgot-password', element: withSuspense(ForgotPassword) },
            { path: '/reset-password', element: withSuspense(ResetPassword) },
            { path: '/change-password', element: withSuspense(ChangePassword) },
            {
                path: '/',
                element: <PublicLayout />,
                children: [
                    { index: true, element: withSuspense(Home) },
                    { path: 'home', element: withSuspense(Home) },
                    { path: 'about', element: withSuspense(About) },
                    { path: 'features', element: withSuspense(Features) },
                    { path: 'contact', element: withSuspense(Contact) },
                    { path: 'pay/invoice/:id', element: withSuspense(PayInvoice) },
                ]
            },
            { path: '/doctors-public', element: withSuspense(FindDoctors) },

            // Director panel (Global)
            {
                element: <RequireDirectorAuth />,
                children: [
                    { path: 'director/dashboard', element: withSuspense(DashboardPage) },
                    { path: 'director/admins', element: withSuspense(AdminsPage) },
                    { path: 'director/users', element: withSuspense(UsersPage) },
                    { path: 'director/plans', element: withSuspense(PlansPage) },
                    { path: 'director/features', element: withSuspense(FeaturesPage) },
                    { path: 'director/analytics', element: <Navigate to="/director/expenses" replace /> },
                    { path: 'director/plans-usage', element: withSuspense(PlansUsagePage) },
                    { path: 'director/queryforplan', element: withSuspense(QueryForPlans) },
                    { path: 'director/receipts', element: withSuspense(ReceiptsPage) },
                    { path: 'director/expenses', element: withSuspense(ExpensesPage) },
                    { path: 'director/customization-requests', element: withSuspense(CustomizationRequests) },
                    { path: 'director/settings', element: withSuspense(SettingsPage) },
                ],
            },
            { path: '/director/test', element: withSuspense(DirectorDashboard) },

            // GLOBAL ROOT LEVEL PROTECTED ROUTES (All share one RequireAuth Layout)
            {
                element: <RequireAuth />, // Authenticates and wraps Layout exactly once
                children: [
                    {
                        path: '/dashboard',
                        element: <RoleGuard allowedRoles={['admin', 'doctor', 'patient', 'subadmin', 'staff', 'director']} />,
                        children: [
                            { index: true, element: withSuspense(RoleBasedDashboard) }
                        ]
                    },
                    {
                        element: <RoleGuard allowedRoles={['admin', 'subadmin']} />,
                        children: [
                            { path: 'inventory', element: withSuspense(Inventory) },
                            { path: 'billing', element: withSuspense(Billing) },
                            { path: 'bill-manager', element: withSuspense(BillManager) },
                            { path: 'purchases', element: withSuspense(Purchases) },
                            { path: 'reports', element: withSuspense(Reports) },
                            { path: 'queries', element: withSuspense(Queries) },
                            { path: 'doctors', element: withSuspense(Doctors) },
                            { path: 'doctor-approvals', element: withSuspense(DoctorApprovals) },
                            { path: 'staff', element: withSuspense(Staff) },
                            { path: 'wards', element: withSuspense(Wards) },
                            { path: 'hrms', element: withSuspense(HRMS) },
                            { path: 'analytics', element: withSuspense(Analytics) },
                        ]
                    },
                    {
                        element: <RoleGuard allowedRoles={['admin']} />,
                        children: [
                            { path: 'subadmin-feature', element: withSuspense(SubadminFeature) },
                        ]
                    },
                    {
                        element: <RoleGuard allowedRoles={['admin', 'subadmin']} />,
                        children: [
                            { path: 'shifts', element: withSuspense(Shifts) },
                            { path: 'attendance', element: withSuspense(Attendance) },
                            { path: 'doctor-attendance-board', element: withSuspense(DoctorAttendanceAdmin) },
                            { path: 'leaves', element: withSuspense(LeaveRequests) },
                            { path: 'wards-live', element: withSuspense(WardsLive) },
                            { path: 'faqs', element: withSuspense(FaqsAdmin) },
                        ]
                    },
                    {
                        element: <RoleGuard allowedRoles={['admin', 'doctor', 'patient', 'subadmin', 'staff']} />,
                        children: [
                            { path: 'appointments', element: withSuspense(Appointments) },
                            { path: 'queue', element: <Navigate to="virtual-room" replace /> },
                            { path: 'availability', element: withSuspense(DoctorAvailability) },
                            { path: 'patients', element: withSuspense(Patients) },
                            { path: 'patients/:id', element: withSuspense(PatientProfile) },
                            { path: 'invoice/:id', element: withSuspense(Invoice) },
                            { path: 'invoices/:id', element: withSuspense(Invoice) },
                            { path: 'virtual-room', element: withSuspense(VirtualRoom) },
                            { path: 'laboratory', element: withSuspense(Laboratory) },
                            { path: 'radiology', element: withSuspense(Radiology) },
                            { path: 'insurance', element: withSuspense(Insurance) },
                            { path: 'ot-management', element: withSuspense(OTManagement) },
                            { path: 'blood-bank', element: withSuspense(BloodBank) },
                            { path: 'ambulance', element: withSuspense(Ambulance) },
                            { path: 'abdm-integration', element: withSuspense(AbdmIntegration) },
                            { path: 'telemedicine', element: withSuspense(Telemedicine) },
                        ]
                    },
                    {
                        element: <RoleGuard allowedRoles={['doctor']} />,
                        children: [
                            { path: 'prescription-templates', element: withSuspense(PrescriptionTemplates) },
                            { path: 'doctor-attendance', element: withSuspense(DoctorAttendance) },
                            { path: 'doctor-patients', element: withSuspense(DoctorPatients) },
                            { path: 'doctor-prescriptions', element: withSuspense(DoctorPrescriptions) },
                        ]
                    },
                    {
                        element: <RoleGuard allowedRoles={['patient']} />,
                        children: [
                            { path: 'my-profile', element: withSuspense(MyProfile) },
                            { path: 'virtual-room', element: withSuspense(VirtualRoom) },
                            { path: 'waiting-room', element: withSuspense(WaitingRoom) },
                            { path: 'my-appointments', element: withSuspense(MyAppointments) },
                            { path: 'prescriptions', element: withSuspense(Prescriptions) },
                            { path: 'medicine-store', element: withSuspense(MedicineStore) },
                            { path: 'my-billing', element: withSuspense(MyBilling) },
                            { path: 'my-receipts', element: withSuspense(MyReceipts) },
                            { path: 'my-reports', element: withSuspense(MyReports) },
                        ]
                    },
                    // TENANT PROTECTED ROUTES (Moved inside root RequireAuth to share Layout/Context instances)
                    {
                        path: 'portal/:hospitalSlug',
                        children: [
                            {
                                element: <RoleGuard allowedRoles={['admin', 'doctor', 'patient', 'subadmin', 'staff']} />,
                                children: [
                                    { path: 'dashboard', element: withSuspense(RoleBasedDashboard) },
                                    { path: 'virtual-room', element: withSuspense(VirtualRoom) },
                                    { path: 'invoice/:id', element: withSuspense(Invoice) },
                                    { path: 'invoices/:id', element: withSuspense(Invoice) },
                                    { path: 'laboratory', element: withSuspense(Laboratory) },
                                    { path: 'radiology', element: withSuspense(Radiology) },
                                    { path: 'insurance', element: withSuspense(Insurance) },
                                    { path: 'ot-management', element: withSuspense(OTManagement) },
                                    { path: 'blood-bank', element: withSuspense(BloodBank) },
                                    { path: 'ambulance', element: withSuspense(Ambulance) },
                                    { path: 'abdm-integration', element: withSuspense(AbdmIntegration) },
                                    { path: 'telemedicine', element: withSuspense(Telemedicine) },
                                ]
                            },
                            {
                                element: <RoleGuard allowedRoles={['admin', 'subadmin']} />,
                                children: [
                                    { path: 'inventory', element: withSuspense(Inventory) },
                                    { path: 'billing', element: withSuspense(Billing) },
                                    { path: 'bill-manager', element: withSuspense(BillManager) },
                                    { path: 'purchases', element: withSuspense(Purchases) },
                                    { path: 'reports', element: withSuspense(Reports) },
                                    { path: 'queries', element: withSuspense(Queries) },
                                    { path: 'doctors', element: withSuspense(Doctors) },
                                    { path: 'doctor-approvals', element: withSuspense(DoctorApprovals) },
                                    { path: 'staff', element: withSuspense(Staff) },
                                    { path: 'hrms', element: withSuspense(HRMS) },
                                    { path: 'analytics', element: withSuspense(Analytics) },
                                    { path: 'wards', element: withSuspense(Wards) },
                                    { path: 'shifts', element: withSuspense(Shifts) },
                                    { path: 'attendance', element: withSuspense(Attendance) },
                                    { path: 'doctor-attendance-board', element: withSuspense(DoctorAttendanceAdmin) },
                                    { path: 'leaves', element: withSuspense(LeaveRequests) },
                                    { path: 'wards-live', element: withSuspense(WardsLive) },
                                    { path: 'faqs', element: withSuspense(FaqsAdmin) },
                                ]
                            },
                            {
                                element: <RoleGuard allowedRoles={['admin']} />,
                                children: [
                                    { path: 'subadmin-feature', element: withSuspense(SubadminFeature) },
                                ]
                            },
                            {
                                element: <RoleGuard allowedRoles={['admin', 'doctor', 'subadmin', 'staff']} />,
                                children: [
                                    { path: 'appointments', element: withSuspense(Appointments) },
                                    { path: 'queue', element: <Navigate to="virtual-room" replace /> },
                                    { path: 'availability', element: withSuspense(DoctorAvailability) },
                                    { path: 'patients', element: withSuspense(Patients) },
                                    { path: 'patients/:id', element: withSuspense(PatientProfile) },
                                ]
                            },
                            {
                                element: <RoleGuard allowedRoles={['doctor']} />,
                                children: [
                                    { path: 'prescription-templates', element: withSuspense(PrescriptionTemplates) },
                                    { path: 'doctor-attendance', element: withSuspense(DoctorAttendance) },
                                    { path: 'doctor-patients', element: withSuspense(DoctorPatients) },
                                    { path: 'doctor-prescriptions', element: withSuspense(DoctorPrescriptions) },
                                ]
                            },
                            {
                                element: <RoleGuard allowedRoles={['patient']} />,
                                children: [
                                    { path: 'my-profile', element: withSuspense(MyProfile) },
                                    { path: 'virtual-room', element: withSuspense(VirtualRoom) },
                                    { path: 'waiting-room', element: withSuspense(WaitingRoom) },
                                    { path: 'my-appointments', element: withSuspense(MyAppointments) },
                                    { path: 'prescriptions', element: withSuspense(Prescriptions) },
                                    { path: 'medicine-store', element: withSuspense(MedicineStore) },
                                    { path: 'my-billing', element: withSuspense(MyBilling) },
                                    { path: 'my-receipts', element: withSuspense(MyReceipts) },
                                    { path: 'my-reports', element: withSuspense(MyReports) },
                                    { path: 'find-doctors', element: withSuspense(FindDoctors) },
                                ]
                            }
                        ]
                    }
                ]
            },

            // TENANT ROUTES
            {
                path: 'portal/:hospitalSlug',
                children: [
                    { index: true, element: withSuspense(HospitalLanding) },
                    { path: 'login', element: withSuspense(Login) },
                    { path: 'signup', element: withSuspense(Signup) },
                    { path: 'apply-doctor', element: withSuspense(DoctorApply) },
                    { path: 'pay/invoice/:id', element: withSuspense(PayInvoice) },
                ]
            },
            {
                path: ':slug',
                element: <LegacyRedirect />
            }
        ]
    }
], {
    future: {
        v7_startTransition: true,
        v7_relativeSplatPath: true,
    }
})
