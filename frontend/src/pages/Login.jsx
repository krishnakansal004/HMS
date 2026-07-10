import { useProfileRender } from '../utils/profiler';
import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import PublicNavbar from '../components/PublicNavbar'
import { useAuth } from '../context/AuthContext'

export default function Login({ directorOnly = false }) {
    useProfileRender('Login', true);
    const { login, token, user, logout } = useAuth()
    const navigate = useNavigate()
    const location = useLocation()
    const { hospitalSlug } = useParams()
    // Only use `from` when it was explicitly provided (avoid defaulting to /dashboard)
    const from = location.state?.from?.pathname || null

    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    // Unified redirection helper
    const performRedirect = (userData) => {
        if (!userData) return

        // 1. Respect 'from' if it exists and isn't just the login/home page
        const safeFrom = (from && !['/login', '/director/login', '/'].includes(from)) ? from : null

        if (safeFrom) {
            navigate(safeFrom, { replace: true })
            return
        }

        // 2. Role-based defaults
        if (userData.role === 'director') {
            navigate('/director/dashboard', { replace: true })
        } else {
            const slug = userData.tenantSlug || userData.tenantPlan?.slug || hospitalSlug
            if (slug) {
                navigate(`/portal/${slug}/dashboard`, { replace: true })
            } else {
                navigate('/dashboard', { replace: true })
            }
        }
    }

    useEffect(() => {
        // If we have a token and user, consider redirecting if we are stuck on Login
        if (token && user && !loading) {
            performRedirect(user)
        }
    }, [token, user, loading])

    const onSubmit = async (e) => {
        e.preventDefault()
        setError('')
        setLoading(true)
        try {
            const res = await login(email.trim(), password, hospitalSlug)
            const userData = res?.user

            if (userData?.mustChangePassword) {
                navigate('/change-password', { replace: true })
                return
            }

            // Redirect will be handled by the useEffect above once token/user state updates,
            // but we can also trigger it here for immediate feedback if state hasn't flushed yet.
            performRedirect(userData)
        } catch (e) {
            setError(e?.response?.data?.error || e.message || 'Login failed')
        } finally { setLoading(false) }
    }

    return (
        <div className="min-h-screen flex flex-col bg-gradient-to-br from-indigo-50 via-sky-50 to-emerald-50 relative">
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <div className="absolute -top-20 -left-24 w-72 h-72 bg-sky-200/30 rounded-full blur-3xl" />
                <div className="absolute bottom-0 -right-24 w-80 h-80 bg-emerald-200/30 rounded-full blur-3xl" />
            </div>
            <PublicNavbar />
            <div className="flex-1 grid place-items-center px-3 sm:px-4 md:px-6 py-16 sm:py-20 md:py-24">
                <div className="w-full max-w-md">
                    <div className="text-center mb-4 sm:mb-6">
                        <div className="mx-auto mb-2 w-8 h-8 sm:w-10 sm:h-10 bg-primary rotate-45 rounded-sm" />
                        <h1 className="text-xl sm:text-2xl font-semibold text-slate-900 px-2">{directorOnly ? 'Director Panel Sign In' : 'Sign in to your account'}</h1>
                        <p className="text-xs sm:text-sm text-slate-500 px-2 mt-1">{directorOnly ? 'Sign in with Director credentials' : 'Access the Hospital Management dashboard'}</p>
                    </div>
                    {error && (
                        <div className="mb-3 sm:mb-4 text-xs sm:text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">{error}</div>
                    )}
                    <div className="p-[2px] rounded-xl sm:rounded-2xl bg-gradient-to-br from-indigo-500 via-sky-400 to-emerald-400 shadow-lg">
                        <form onSubmit={onSubmit} className="rounded-xl sm:rounded-2xl bg-white/95 backdrop-blur p-4 sm:p-5 md:p-6">
                            <div className="space-y-3 sm:space-y-4">
                                <div>
                                    <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1">Email</label>
                                    <input type="email" autoComplete="username" className="input text-sm sm:text-base" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@hospital.com" required />
                                </div>
                                <div>
                                    <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1">Password</label>
                                    <input type="password" autoComplete="current-password" className="input text-sm sm:text-base" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required />
                                </div>
                            </div>
                            <div className="mt-4 sm:mt-5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                                <Link to="/forgot-password" className="text-xs text-primary hover:underline text-center sm:text-left">Forgot password?</Link>
                                <button type="submit" disabled={loading} className="btn btn-primary text-xs sm:text-sm w-full sm:w-auto">{loading ? 'Signing in…' : 'Sign In'}</button>
                            </div>
                            <div className="mt-4 sm:mt-5 text-xs sm:text-sm text-slate-600 text-center flex items-center justify-center gap-2 cursor-pointer hover:text-slate-800" onClick={() => window.location.href = '/auth/google'}>
                                <img src = "../../googleLogo.webp" width="20" height="20" />
                                Sign in with Google
                            </div>
                        </form>
                    </div>
                    {/* Sign-up link removed from main login page per request */}
                </div>
            </div>
        </div>
    )
}

