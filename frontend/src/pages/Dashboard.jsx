import { useAuthStore } from '../store/authStore.js';
import { ROLES } from '../utils/roles.js';
import PatientDashboard from './dashboard/PatientDashboard.jsx';
import StaffDashboard from './dashboard/StaffDashboard.jsx';

export default function Dashboard() {
  const user = useAuthStore((s) => s.user);
  if (user?.role === ROLES.PATIENT) return <PatientDashboard user={user} />;
  return <StaffDashboard user={user} />;
}
