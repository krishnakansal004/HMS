import { useProfileRender } from '../utils/profiler';
import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { resetPassword } from '../services/api'

export default function ResetPassword() {
    useProfileRender('ResetPassword', true);
    const [params] = useSearchParams()
    const navigate = useNavigate()
    const emailParam = params.get('email') || ''
    const tokenParam = params.get('token') || ''
    const hospitalSlugParam = params.get('hospitalSlug') || ''
    const [password, setPassword] = useState('')
    const [confirm, setConfirm] = useState('')
    const [error, setError] = useState('')
    const [done, setDone] = useState(false)
    const [loading, setLoading] = useState(false)
    const [redirectTo, setRedirectTo] = useState('/login')

    useEffect(() => {
        if (!emailParam || !tokenParam) {
            setError('Invalid reset link')
        }
    }, [emailParam, tokenParam])

    const onSubmit = async (e) => {
        e.preventDefault()
        setError('')
        if (password.length < 8) {
            setError('Password must be at least 8 characters')
            return
        }
        if (password !== confirm) {
            setError('Passwords do not match')
            return
        }
        setLoading(true)
        try {
            const data = await resetPassword(emailParam, tokenParam, password)
            const slug = data?.tenantSlug || hospitalSlugParam
            const target = slug ? `/portal/${slug}/login` : '/login'
            setRedirectTo(target)
            setDone(true)
            // Auto redirect after short delay
            setTimeout(() => navigate(target), 1500)
        } catch (err) {
            setError(err.data?.error || err.message || 'Reset failed')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen grid place-items-center bg-slate-100 px-3 sm:px-4">
            <div className="w-full max-w-md bg-white p-4 sm:p-5 md:p-6 rounded-xl shadow border border-slate-200">
                <div className="mb-4 sm:mb-6 text-center">
                    <div className="mx-auto mb-2 w-8 h-8 sm:w-10 sm:h-10 bg-primary rotate-45 rounded-sm" />
                    <h1 className="text-xl sm:text-2xl font-semibold">Reset Password</h1>
                    <p className="text-xs sm:text-sm text-slate-500 mt-1">Enter a new password for <strong className="break-all">{emailParam}</strong>.</p>
                </div>
                {error && <div className="mb-3 sm:mb-4 text-xs sm:text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">{error}</div>}
                {done ? (
                    <div className="space-y-3 sm:space-y-4">
                        <div className="text-xs sm:text-sm text-green-700 bg-green-50 border border-green-200 rounded p-2 sm:p-3">Password updated. Redirecting...</div>
                        <Link to={redirectTo} className="text-primary text-xs sm:text-sm text-center block hover:underline">Go to login</Link>
                    </div>
                ) : (
                    <form onSubmit={onSubmit} className="space-y-3 sm:space-y-4">
                        <div>
                            <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1">New Password</label>
                            <input type="password" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-primary/50" value={password} onChange={e => setPassword(e.target.value)} required />
                        </div>
                        <div>
                            <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1">Confirm Password</label>
                            <input type="password" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-primary/50" value={confirm} onChange={e => setConfirm(e.target.value)} required />
                        </div>
                        <button type="submit" disabled={loading} className="w-full btn btn-primary text-xs sm:text-sm">{loading ? 'Updating...' : 'Update password'}</button>
                    </form>
                )}
                <div className="mt-3 sm:mt-4 text-xs text-slate-500 text-center">
                    Need to request again? <Link to="/forgot-password" className="text-primary hover:underline">Forgot Password</Link>
                </div>
            </div>
        </div>
    )
}

