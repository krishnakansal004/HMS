import { Navigate, Outlet, useLocation, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Layout from './Layout'
import { allNav } from '../constants/navigation'

// Layout wrapper + Authentication check
export default function RequireAuth() {
    const { token, loading } = useAuth()
    const location = useLocation()
    const { hospitalSlug } = useParams()

    if (loading) {
        return (
            <div className="min-h-screen grid place-items-center">
                <div className="text-slate-600">Loading...</div>
            </div>
        )
    }

    if (!token) {
        const loginPath = hospitalSlug ? `/portal/${hospitalSlug}/login` : '/login'
        return <Navigate to={loginPath} replace state={{ from: location }} />
    }

    return (
        <Layout>
            <Outlet />
        </Layout>
    )
}

// Layout-less permissions guard
export function RoleGuard({ allowedRoles, requiredFeature }) {
    const { user } = useAuth()
    const location = useLocation()
    const { hospitalSlug } = useParams()

    if (allowedRoles && !allowedRoles.includes(user?.role)) {
        return <Navigate to="/" replace />
    }

    // Sub-admin granular feature check
    if (user?.role === 'subadmin') {
        const features = user.features || []
        let feat = requiredFeature

        // If no explicit feature required, try to infer it from the navigation config
        if (!feat) {
            const path = location.pathname
            // Skip check for dashboard root
            if (path !== '/' && !path.endsWith('/dashboard')) {
                const match = (allNav || []).find(n => {
                    if (n.to === '/' || !n.to) return false
                    const globalPath = n.to
                    const tenantPath = hospitalSlug ? `/portal/${hospitalSlug}${n.to}` : null
                    return path === globalPath || (tenantPath && path === tenantPath) || 
                           path.startsWith(globalPath + '/') || (tenantPath && path.startsWith(tenantPath + '/'))
                })
                if (match) feat = match.label
            }
        }

        // Enforce the feature check if we identified a required feature
        if (feat && feat !== 'Dashboard' && !features.some(f => String(f).toLowerCase() === String(feat).toLowerCase())) {
            console.warn(`[Auth] Subadmin access denied to feature: ${feat} for path: ${location.pathname}. Available features: [${features.join(', ')}]`)
            return <Navigate to="/" replace />
        }
    }

    if (user?.mustChangePassword && location.pathname !== '/change-password') {
        return <Navigate to="/change-password" replace />
    }

    return <Outlet />
}
