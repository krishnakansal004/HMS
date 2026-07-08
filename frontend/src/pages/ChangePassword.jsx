import { useProfileRender } from '../utils/profiler';

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { changePassword } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { toast } from 'react-toastify'
import { Shield, Lock, Eye, EyeOff, Save } from 'lucide-react'
import PublicNavbar from '../components/PublicNavbar'

export default function ChangePassword() {
    useProfileRender('ChangePassword', true);
    const { user, refreshUser, logout } = useAuth()
    const navigate = useNavigate()
    const [currentPassword, setCurrentPassword] = useState('')
    const [newPassword, setNewPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [showPw, setShowPw] = useState(false)

    const onSubmit = async (e) => {
        e.preventDefault()
        if (newPassword !== confirmPassword) {
            return toast.error('New passwords do not match')
        }
        if (newPassword.length < 6) {
            return toast.error('Password must be at least 6 characters')
        }

        setLoading(true)
        try {
            await changePassword(currentPassword, newPassword)
            toast.success('Password updated successfully')
            await refreshUser()
            // Redirect based on role
            if (user?.role === 'director') navigate('/director/dashboard')
            else if (user?.tenantSlug) navigate(`/portal/${user.tenantSlug}/dashboard`)
            else navigate('/dashboard')
        } catch (err) {
            toast.error(err?.response?.data?.error || err.message || 'Failed to update password')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex flex-col bg-gradient-to-br from-indigo-50 via-white to-emerald-50">
            <PublicNavbar />
            <div className="flex-1 grid place-items-center p-4">
                <div className="w-full max-w-md">
                    <div className="text-center mb-8">
                        <div className="w-16 h-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <Shield size={32} />
                        </div>
                        <h1 className="text-2xl font-bold text-slate-900">Final Security Step</h1>
                        <p className="text-slate-500 mt-2">
                            {user?.mustChangePassword
                                ? "For your security, you must update your temporary password before accessing your dashboard."
                                : "Update your account password below."}
                        </p>
                    </div>

                    <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/60 border border-slate-100 p-6 md:p-8">
                        <form onSubmit={onSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                                    <Lock size={14} /> Current Password
                                </label>
                                <div className="relative">
                                    <input
                                        type={showPw ? "text" : "password"}
                                        required
                                        className="input w-full pr-10"
                                        placeholder="Enter current password"
                                        value={currentPassword}
                                        onChange={e => setCurrentPassword(e.target.value)}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPw(!showPw)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary transition-colors"
                                    >
                                        {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>

                            <div className="pt-4 space-y-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-700">New Password</label>
                                    <input
                                        type="password"
                                        required
                                        className="input w-full"
                                        placeholder="Minimum 6 characters"
                                        value={newPassword}
                                        onChange={e => setNewPassword(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-700">Confirm New Password</label>
                                    <input
                                        type="password"
                                        required
                                        className="input w-full"
                                        placeholder="Repeat new password"
                                        value={confirmPassword}
                                        onChange={e => setConfirmPassword(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="pt-6 flex flex-col gap-3">
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="btn btn-primary w-full h-12 flex items-center justify-center gap-2"
                                >
                                    {loading ? 'Updating...' : <><Save size={18} /> Update & Continue</>}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => logout()}
                                    className="text-sm text-slate-400 hover:text-red-500 transition-colors py-2"
                                >
                                    Sign out and cancel
                                </button>
                            </div>
                        </form>
                    </div>

                    <div className="mt-8 text-center text-xs text-slate-400">
                        Securely powered by IITianCraft HMS
                    </div>
                </div>
            </div>
        </div>
    )
}

