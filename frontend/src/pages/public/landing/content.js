// Every line here maps to a real, working module in this codebase — see
// the comment on each entry. Nothing here describes a capability that
// isn't backed by an actual route + page in frontend/src/routes/router.jsx.
import {
  Users,
  CalendarClock,
  BedDouble,
  Stethoscope,
  Receipt,
  Pill,
  FlaskConical,
  Scan,
  ShieldCheck,
  Truck,
  ClipboardList,
  UsersRound,
  KeyRound,
  Building2,
  Lock,
} from 'lucide-react';

export const FEATURES = [
  {
    icon: Users,
    title: 'Patient records',
    // patients.js routes + PatientsList/PatientDetails pages
    description:
      'One record per patient — demographics, medical history, allergies, and visit history — shared across reception, nursing, and doctors instead of living in separate notebooks.',
  },
  {
    icon: CalendarClock,
    title: 'Appointments',
    // appointments.js + availability.js
    description:
      'Book against real doctor availability and keep reception, doctors, and the patient portal looking at the same schedule.',
  },
  {
    icon: BedDouble,
    title: 'Admissions & wards',
    // admissions.js + wards.js
    description:
      'Track bed occupancy and admissions across wards so nursing staff always know what is free and who is where.',
  },
  {
    icon: Receipt,
    title: 'Billing & online payments',
    // invoices.js + payments.js (Razorpay)
    description:
      'Generate itemized invoices and let patients pay pending balances online from their own portal, with payments reconciled straight into the invoice record.',
  },
  {
    icon: Pill,
    title: 'Pharmacy & inventory',
    // inventory.js + purchases.js + suppliers.js
    description:
      'Track stock levels and raise purchase orders to suppliers before shelves run out, from the same system that records what was prescribed.',
  },
  {
    icon: FlaskConical,
    title: 'Lab & radiology orders',
    // lab.js + radiology.js
    description:
      'Doctors order lab and imaging work directly from a patient chart; technicians see an incoming queue instead of paper slips.',
  },
  {
    icon: ShieldCheck,
    title: 'Insurance claims',
    // insurance.js
    description:
      'Log and track insurance claims against invoices instead of chasing status by phone.',
  },
  {
    icon: UsersRound,
    title: 'Staff & HR',
    // hrms.js + attendance.js + doctorAttendance.js + doctorApplications.js
    description:
      'Manage staff records and attendance, and review incoming doctor applications for your hospital in one place.',
  },
];

export const ROLE_VALUE = [
  {
    icon: Building2,
    role: 'Hospital administrators',
    points: [
      'Oversee patients, appointments, billing, and staff for your hospital',
      'Review doctor applications and manage your care team',
      'See operational activity across every module you use',
    ],
  },
  {
    icon: Stethoscope,
    role: 'Doctors & nurses',
    points: [
      'Work from a shared appointment schedule and patient chart',
      'Order lab and radiology work and write prescriptions directly',
      'Track ward and bed status for admitted patients',
    ],
  },
  {
    icon: ClipboardList,
    role: 'Front-desk & billing staff',
    points: [
      'Register patients and manage the day\u2019s appointment queue',
      'Generate invoices and record payments, including online payments',
      'Track insurance claims tied to billing',
    ],
  },
  {
    icon: Users,
    role: 'Patients',
    points: [
      'View your own appointments from a dedicated patient portal',
      'Pay pending invoice balances online',
      'See your billing history in one place',
    ],
  },
];

export const TRUST_POINTS = [
  {
    icon: KeyRound,
    title: 'Role-based access',
    description:
      'Fourteen distinct roles, each scoped server-side to only the endpoints their job needs — not just a hidden menu item.',
  },
  {
    icon: Lock,
    title: 'Tenant isolation',
    description:
      'Every hospital\u2019s data is scoped to its own tenant at the database layer. Staff in one hospital cannot reach another hospital\u2019s records.',
  },
  {
    icon: ShieldCheck,
    title: 'Session security',
    description:
      'Short-lived access tokens held in memory, not browser storage, with a separate httpOnly refresh flow \u2014 the standard the rest of this app is built on.',
  },
];

export const WORKFLOW_STEPS = [
  {
    title: 'Register your hospital',
    description: 'Pick a plan and set up your hospital\u2019s workspace with its first administrator account.',
  },
  {
    title: 'Bring your team on',
    description: 'Add doctors, nurses, front-desk and pharmacy staff, each with access scoped to their role.',
  },
  {
    title: 'Run day-to-day operations',
    description: 'Patients, appointments, admissions, billing, pharmacy, and lab/radiology orders — from one workspace.',
  },
  {
    title: 'Give patients a portal',
    description: 'Patients can view their appointments and pay outstanding invoices online.',
  },
];
