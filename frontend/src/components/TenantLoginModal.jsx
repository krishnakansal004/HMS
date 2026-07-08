import { useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { X, User, Lock, ArrowRight } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export default function TenantLoginModal({ open, onClose, themeColor = '#2563eb', logoUrl, hospitalName }) {
    const { login } = useAuth()
    const navigate = useNavigate()
    const { hospitalSlug } = useParams()

    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    const onSubmit = async (e) => {
        e.preventDefault()
        setError('')
        setLoading(true)
        try {
            // Force hospitalSlug context
            const res = await login(email.trim(), password, hospitalSlug)
            const role = res?.user?.role

            // Navigate based on role but keep in portal context if possible
            if (role === 'director') {
                navigate('/director/dashboard')
            } else {
                // Patient/Admin/Doctor -> Portal Dashboard
                navigate(`/portal/${hospitalSlug}/dashboard`)
            }
            onClose()
        } catch (e) {
            setError(e?.data?.error || e.message || 'Login failed')
        } finally {
            setLoading(false)
        }
    }

    if (!open) return null

    return (
        <AnimatePresence>
            {open && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                    />

                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden"
                    >
                        <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-100 text-slate-500 transition-colors z-10">
                            <X size={20} />
                        </button>

                        <div className="p-8">
                            <div className="text-center mb-8">
                                {logoUrl ? (
                                    <img src={logoUrl} alt={hospitalName} className="h-12 mx-auto mb-4 object-contain" />
                                ) : (
                                    <div className="h-12 w-12 bg-slate-900 rounded-xl flex items-center justify-center text-white font-bold text-xl mx-auto mb-4" style={{ backgroundColor: themeColor }}>
                                        {hospitalName?.[0]}
                                    </div>
                                )}
                                <h2 className="text-2xl font-bold text-slate-900">Welcome Back</h2>
                                <p className="text-slate-500 mt-1">Sign in to {hospitalName} Portal</p>
                            </div>

                            {error && (
                                <div className="mb-6 p-3 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm text-center font-medium">
                                    {error}
                                </div>
                            )}

                            <form onSubmit={onSubmit} className="space-y-5">
                                <div className="space-y-1.5">
                                    <label className="text-sm font-semibold text-slate-700 ml-1">Email Address</label>
                                    <div className="relative">
                                        <User className="absolute left-4 top-3.5 text-slate-400" size={20} />
                                        <input
                                            type="email"
                                            required
                                            value={email}
                                            onChange={e => setEmail(e.target.value)}
                                            className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none font-medium"
                                            placeholder="you@example.com"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <div className="flex justify-between items-center ml-1">
                                        <label className="text-sm font-semibold text-slate-700">Password</label>
                                    </div>
                                    <div className="relative">
                                        <Lock className="absolute left-4 top-3.5 text-slate-400" size={20} />
                                        <input
                                            type="password"
                                            required
                                            value={password}
                                            onChange={e => setPassword(e.target.value)}
                                            className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none font-medium"
                                            placeholder="••••••••"
                                        />
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full py-4 rounded-xl font-bold text-white shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 hover:-translate-y-0.5 transition-all active:scale-95 flex items-center justify-center gap-2"
                                    style={{ backgroundColor: themeColor }}
                                >
                                    {loading ? (
                                        <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        <>Sign In <ArrowRight size={20} /></>
                                    )}
                                </button>
                            </form>

                            <div className="mt-6 text-center">
                                <Link to="/forgot-password" className="text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors">
                                    Forgot your password?
                                </Link>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    )
}
