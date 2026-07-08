import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import DirectorLayout from './director/DirectorLayout'

export default function RequireDirectorAuth() {
    const { token, user, loading } = useAuth()
    const location = useLocation()

    if (loading) return <div className="min-h-screen grid place-items-center">Loading...</div>

    if (!token) return <Navigate to="/login" replace state={{ from: location }} />

    if (user?.role !== 'director') return <Navigate to="/" replace />

    return (
        <DirectorLayout>
            <Outlet />
        </DirectorLayout>
    )
}
