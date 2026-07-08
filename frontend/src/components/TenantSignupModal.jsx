import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { X, User, Mail, Lock, ArrowRight, Phone } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { register } from '../services/api' // Assuming a public register function exists or using AuthContext

export default function TenantSignupModal({ open, onClose, themeColor = '#2563eb', logoUrl, hospitalName }) {
    const { login } = useAuth() // Auto login after signup
    const navigate = useNavigate()
    const { hospitalSlug } = useParams()

    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        confirmPassword: ''
    })
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    const onSubmit = async (e) => {
        e.preventDefault()
        if (formData.password !== formData.confirmPassword) {
            setError("Passwords don't match")
            return
        }

        setError('')
        setLoading(true)
        try {
            // 1. Register
            // We need a register function that accepts tenantId/slug context if we want to associate them immediately
            // For now, using the standard register but we might need to auto-associate.
            // Actually, usually registration is generic, but let's assume standard register for now.
            // Ideally, we should pass hospitalSlug to register so backend knows who they belong to.

            await register(formData.name, formData.email, formData.password, hospitalSlug)

            // 2. Auto Login
            await login(formData.email, formData.password, hospitalSlug)

            navigate(`/portal/${hospitalSlug}/dashboard`)
            onClose()
        } catch (e) {
            setError(e?.response?.data?.error || e.message || 'Registration failed')
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
                                <h2 className="text-2xl font-bold text-slate-900">New Patient Registration</h2>
                                <p className="text-slate-500 mt-1">Join {hospitalName} to book appointments</p>
                            </div>

                            {error && (
                                <div className="mb-6 p-3 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm text-center font-medium">
                                    {error}
                                </div>
                            )}

                            <form onSubmit={onSubmit} className="space-y-4">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500 ml-1">Full Name</label>
                                    <div className="relative">
                                        <User className="absolute left-4 top-3.5 text-slate-400" size={18} />
                                        <input
                                            type="text"
                                            required
                                            value={formData.name}
                                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                                            className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none font-medium text-sm"
                                            placeholder="John Doe"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500 ml-1">Email Address</label>
                                    <div className="relative">
                                        <Mail className="absolute left-4 top-3.5 text-slate-400" size={18} />
                                        <input
                                            type="email"
                                            required
                                            value={formData.email}
                                            onChange={e => setFormData({ ...formData, email: e.target.value })}
                                            className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none font-medium text-sm"
                                            placeholder="you@example.com"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold uppercase tracking-wider text-slate-500 ml-1">Password</label>
                                        <div className="relative">
                                            <Lock className="absolute left-4 top-3.5 text-slate-400" size={18} />
                                            <input
                                                type="password"
                                                required
                                                value={formData.password}
                                                onChange={e => setFormData({ ...formData, password: e.target.value })}
                                                className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none font-medium text-sm"
                                                placeholder="••••••"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold uppercase tracking-wider text-slate-500 ml-1">Confirm</label>
                                        <div className="relative">
                                            <Lock className="absolute left-4 top-3.5 text-slate-400" size={18} />
                                            <input
                                                type="password"
                                                required
                                                value={formData.confirmPassword}
                                                onChange={e => setFormData({ ...formData, confirmPassword: e.target.value })}
                                                className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none font-medium text-sm"
                                                placeholder="••••••"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full py-4 rounded-xl font-bold text-white shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 hover:-translate-y-0.5 transition-all active:scale-95 flex items-center justify-center gap-2 mt-2"
                                    style={{ backgroundColor: themeColor }}
                                >
                                    {loading ? (
                                        <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        <>Create & Book <ArrowRight size={18} /></>
                                    )}
                                </button>
                            </form>

                            <p className="mt-6 text-center text-xs text-slate-400">
                                By continuing, you agree to our Terms of Service & Privacy Policy.
                            </p>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    )
}
