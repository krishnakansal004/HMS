import { useProfileRender } from '../../utils/profiler';
import React, { useState, useMemo } from 'react'
import { useAuth } from '../../context/AuthContext'
import { authFetch } from '../../services/api'
import { Users, Search, Phone, Mail, Building, CheckCircle, XCircle } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'

export default function UsersPage() {
    useProfileRender('UsersPage', true);
    const { token } = useAuth()
    const [q, setQ] = useState('')

    const { data: users = [], isLoading: loading, error: queryError } = useQuery({
        queryKey: ['directorAdmins', ''],
        queryFn: () => authFetch(`/api/director/admins`),
        enabled: !!token
    })

    const error = queryError?.message

    const filteredUsers = useMemo(() => {
        return users.filter(u =>
            u.name?.toLowerCase().includes(q.toLowerCase()) ||
            u.email?.toLowerCase().includes(q.toLowerCase()) ||
            u.hospitalName?.toLowerCase().includes(q.toLowerCase())
        )
    }, [users, q])

    return (
        <div className="p-4 md:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 tracking-tight">System Users</h1>
                    <p className="text-slate-500">View all registered users across tenants.</p>
                </div>
                <div className="relative w-full sm:w-72">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                        value={q}
                        onChange={e => setQ(e.target.value)}
                        placeholder="Search users..."
                        className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all shadow-sm"
                    />
                </div>
            </div>

            {error && <div className="p-4 bg-red-50 text-red-600 rounded-xl border border-red-100">{error}</div>}

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="table-responsive overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[1000px]">
                        <thead>
                            <tr className="bg-slate-50/50 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                <th className="px-6 py-4">User Details</th>
                                <th className="px-6 py-4">Tenant / Plan</th>
                                <th className="px-6 py-4">Contact</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4">Joined</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            <AnimatePresence>
                                {loading ? (
                                    <tr><td colSpan={5} className="p-8 text-center text-slate-400">Loading...</td></tr>
                                ) : filteredUsers.length === 0 ? (
                                    <tr><td colSpan={5} className="p-8 text-center text-slate-400">No users found.</td></tr>
                                ) : filteredUsers.map((u, i) => (
                                    <motion.tr
                                        key={u.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: i * 0.03 }}
                                        className="hover:bg-slate-50/80 transition-colors group"
                                    >
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                                                    <Users size={16} />
                                                </div>
                                                <div>
                                                    <div className="font-medium text-slate-800">{u.name}</div>
                                                    <div className="text-xs text-slate-500">{u.email}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
                                                    <Building size={14} className="text-slate-400" />
                                                    {u.tenant?.name || u.hospitalName || 'N/A'}
                                                </div>
                                                <span className="text-xs text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100 w-fit">
                                                    {u.plan?.name || 'Standard'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-slate-600">
                                            <div className="flex items-center gap-2">
                                                <Phone size={14} className="text-slate-400" />
                                                {u.phone || '-'}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            {u.blocked ? (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-bold border border-slate-200">
                                                    <XCircle size={12} /> Blocked
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600 text-xs font-bold border border-emerald-100">
                                                    <CheckCircle size={12} /> Active
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-slate-500">
                                            {new Date(u.createdAt).toLocaleDateString()}
                                        </td>
                                    </motion.tr>
                                ))}
                            </AnimatePresence>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
