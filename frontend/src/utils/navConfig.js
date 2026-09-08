import {
  LayoutDashboard,
  Users,
  CalendarClock,
  BedDouble,
  ClipboardList,
  Receipt,
  ShieldCheck,
  FlaskConical,
  Scan,
  Pill,
  Truck,
  Wallet,
  Clock,
  FileStack,
  Settings as SettingsIcon,
  Building2,
  Stethoscope,
  UserPlus,
} from 'lucide-react';
import { ROLES } from './roles.js';

// Each `roles` array is the UNION of every requireRoles(...) gate found
// across that module's route file — i.e. "can reach at least one screen
// in this module". This is a navigation convenience, NOT the security
// boundary; the API enforces the real per-endpoint check independently,
// so a nav miss here fails safe (item hidden) rather than unsafe.
export const NAV_ITEMS = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    to: '/dashboard',
    icon: LayoutDashboard,
    roles: null, // everyone signed in
  },
  {
    key: 'patients',
    label: 'Patients',
    to: '/patients',
    icon: Users,
    roles: [ROLES.HOSPITAL_ADMIN, ROLES.RECEPTIONIST, ROLES.DOCTOR, ROLES.NURSE],
  },
  {
    key: 'appointments',
    label: 'Appointments',
    to: '/appointments',
    icon: CalendarClock,
    roles: [ROLES.HOSPITAL_ADMIN, ROLES.RECEPTIONIST, ROLES.DOCTOR, ROLES.PATIENT],
  },
  {
    key: 'admissions',
    label: 'Admissions',
    to: '/admissions',
    icon: ClipboardList,
    roles: [ROLES.HOSPITAL_ADMIN, ROLES.DOCTOR, ROLES.NURSE, ROLES.RECEPTIONIST],
  },
  {
    key: 'wards',
    label: 'Wards & Beds',
    to: '/wards',
    icon: BedDouble,
    roles: [ROLES.HOSPITAL_ADMIN, ROLES.NURSE, ROLES.RECEPTIONIST, ROLES.DOCTOR],
  },
  {
    key: 'prescriptions',
    label: 'Prescriptions',
    to: '/prescriptions',
    icon: FileStack,
    roles: [ROLES.HOSPITAL_ADMIN, ROLES.DOCTOR, ROLES.PHARMACIST, ROLES.NURSE],
  },
  {
    key: 'lab',
    label: 'Laboratory',
    to: '/lab',
    icon: FlaskConical,
    roles: [ROLES.HOSPITAL_ADMIN, ROLES.DOCTOR, ROLES.LAB_TECHNICIAN, ROLES.RECEPTIONIST],
  },
  {
    key: 'radiology',
    label: 'Radiology',
    to: '/radiology',
    icon: Scan,
    roles: [ROLES.HOSPITAL_ADMIN, ROLES.DOCTOR, ROLES.RADIOLOGY_TECHNICIAN, ROLES.RECEPTIONIST],
  },
  {
    key: 'inventory',
    label: 'Pharmacy Inventory',
    to: '/inventory',
    icon: Pill,
    roles: [ROLES.HOSPITAL_ADMIN, ROLES.PHARMACIST, ROLES.STORE_MANAGER, ROLES.NURSE, ROLES.DOCTOR],
  },
  {
    key: 'purchases',
    label: 'Purchases',
    to: '/purchases',
    icon: Truck,
    roles: [ROLES.HOSPITAL_ADMIN, ROLES.STORE_MANAGER, ROLES.ACCOUNTANT],
  },
  {
    key: 'invoices',
    label: 'Billing',
    to: '/invoices',
    icon: Receipt,
    roles: [ROLES.HOSPITAL_ADMIN, ROLES.ACCOUNTANT, ROLES.CASHIER, ROLES.RECEPTIONIST, ROLES.DOCTOR],
  },
  {
    key: 'insurance',
    label: 'Insurance Claims',
    to: '/insurance',
    icon: ShieldCheck,
    roles: [ROLES.HOSPITAL_ADMIN, ROLES.ACCOUNTANT, ROLES.RECEPTIONIST, ROLES.DOCTOR],
  },
  {
    key: 'expenses',
    label: 'Expenses',
    to: '/expenses',
    icon: Wallet,
    roles: [ROLES.HOSPITAL_ADMIN, ROLES.ACCOUNTANT, ROLES.HR],
  },
  {
    key: 'attendance',
    label: 'Attendance',
    to: '/attendance',
    icon: Clock,
    roles: [ROLES.HOSPITAL_ADMIN, ROLES.HR, ROLES.DOCTOR, ROLES.NURSE, ROLES.RECEPTIONIST, ROLES.PHARMACIST, ROLES.LAB_TECHNICIAN],
  },
  {
    key: 'settings',
    label: 'Settings',
    to: '/settings',
    icon: SettingsIcon,
    roles: [ROLES.HOSPITAL_ADMIN, ROLES.DOCTOR, ROLES.ACCOUNTANT, ROLES.RECEPTIONIST],
  },
  {
    key: 'plans',
    label: 'Plans & Tenants',
    to: '/plans',
    icon: Building2,
    roles: [ROLES.SYSTEM_OWNER, ROLES.DIRECTOR],
  },
  {
    key: 'doctor-applications',
    label: 'Review Applicant',
    to: '/doctor-applications',
    icon: UserPlus,
    roles: [ROLES.HOSPITAL_ADMIN, ROLES.DIRECTOR],
  },
  {
  key: 'doctors',
  label: 'Doctors & Staff',
  to: '/doctors',
  icon: Stethoscope,
  roles: [ROLES.HOSPITAL_ADMIN, ROLES.DIRECTOR],
},
{
  key: 'hrms',
  label: 'HRMS & Staff',
  to: '/hrms',
  icon: Users, 
  roles: [ROLES.HOSPITAL_ADMIN, ROLES.HR, ROLES.DIRECTOR],
},
{ 
  key: 'doctor-attendance', 
  label: 'Doctor Attendance', 
  icon: CalendarClock, 
  to: '/doctor-attendance', 
  roles: ['HOSPITAL_ADMIN', 'HR', 'DIRECTOR', 'DOCTOR'] 
},
];

export function navForRole(role) {
  return NAV_ITEMS.filter((item) => item.roles === null || item.roles.includes(role));
}
