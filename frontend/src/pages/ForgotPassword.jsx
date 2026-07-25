import { useProfileRender } from '../utils/profiler';
import { useState } from 'react'
import { forgotPassword } from '../services/api'
import { Link } from 'react-router-dom'

export default function ForgotPassword() {
    useProfileRender('ForgotPassword', true);
    const [email, setEmail] = useState('')
    const [sent, setSent] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    const onSubmit = async (e) => {
        e.preventDefault()
        setError('')
        setLoading(true)
        try {
            await forgotPassword(email)
            setSent(true)
        } catch (err) {
            setError(err.data?.error || err.message || 'Request failed')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen grid place-items-center bg-slate-100">
            <div className="w-full max-w-md bg-white p-6 rounded-xl shadow border border-slate-200">
                <div className="mb-6 text-center">
                    <div className="mx-auto mb-2 w-10 h-10 bg-primary rotate-45 rounded-sm" />
                    <h1 className="text-2xl font-semibold">Forgot Password</h1>
                    <p className="text-sm text-slate-500">Enter your account email to receive reset instructions.</p>
                </div>
                {error && <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">{error}</div>}
                {sent ? (
                    <div className="space-y-4">
                        <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded p-3">If the email exists, reset instructions have been sent.</div>
                        <div className="text-xs text-slate-500 text-center">Check your inbox (and spam folder). The link expires in 30 minutes.</div>
                        <Link to="/login" className="text-primary text-sm text-center block hover:underline">Back to login</Link>
                    </div>
                ) : (
                    <form onSubmit={onSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                            <input type="email" className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/50" value={email} onChange={e => setEmail(e.target.value)} required />
                        </div>
                        <button type="submit" disabled={loading} className="w-full btn btn-primary">{loading ? 'Sending...' : 'Send reset link'}</button>
                    </form>
                )}
                {!sent && (
                    <div className="mt-4 text-xs text-slate-500 text-center">
                        Remembered? <Link to="/login" className="text-primary hover:underline">Back to login</Link>
                    </div>
                )}
            </div>
        </div>
    )
}

