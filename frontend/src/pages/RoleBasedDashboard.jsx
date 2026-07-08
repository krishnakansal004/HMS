import { useProfileRender } from '../utils/profiler';
import { useAuth } from '../context/AuthContext'
import { useParams, Navigate } from 'react-router-dom'
import { memo } from 'react'
import Dashboard from './Dashboard'
import DoctorDashboard from './DoctorDashboard'
import PatientDashboard from './PatientDashboard'

const RoleBasedDashboard = memo(function RoleBasedDashboard() {
    useProfileRender('RoleBasedDashboard', true);
    const { user, loading } = useAuth()
    const { hospitalSlug } = useParams()
    const role = user?.role

    if (loading || !user) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
            </div>
        )
    }

    // If user belongs to a tenant but accessing generic dashboard or wrong portal, redirect to correct portal
    if (user.tenantSlug) {
        if (!hospitalSlug || hospitalSlug !== user.tenantSlug) {
            return <Navigate to={`/portal/${user.tenantSlug}/dashboard`} replace />
        }
    }

    if (role === 'director') return <Navigate to="/director/dashboard" replace />
    if (role === 'patient') return <PatientDashboard />
    if (role === 'doctor') return <DoctorDashboard />
    if (role === 'staff') return <Dashboard /> // or specific staff dashboard if exists
    // default admin dashboard
    return <Dashboard />
})

export default RoleBasedDashboard

