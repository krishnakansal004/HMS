import { useProfileRender } from '../../utils/profiler';
import React, { useState, useCallback } from 'react'
import { useAuth } from '../../context/AuthContext'
import { authFetch } from '../../services/api'
import { Plus, Edit3, Trash2, Check, X, Layers, DollarSign, Users, Shield, Clock } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

const NAV = [
    { to: '/', label: 'Dashboard', key: 'dashboard', roles: ['admin', 'doctor', 'patient'] },
    { to: '/inventory', label: 'Inventory', key: 'inventory', roles: ['admin'] },
    { to: '/billing', label: 'Billing', key: 'billing', roles: ['admin'] },
    { to: '/bill-manager', label: 'Bill Manager', key: 'billManager', roles: ['admin'] },
    { to: '/purchases', label: 'Purchases', key: 'purchases', roles: ['admin'] },
    { to: '/reports', label: 'Reports', key: 'reports', roles: ['admin'] },
    { to: '/appointments', label: 'Appointments', key: 'appointments', roles: ['admin', 'doctor'] },
    { to: '/doctor-patients', label: 'My Patients', key: 'doctorPatients', roles: ['doctor'] },
    { to: '/doctor-prescriptions', label: 'Prescriptions', key: 'doctorPrescriptions', roles: ['doctor'] },
    { to: '/virtual-room', label: 'Virtual Room', key: 'virtualRoom', roles: ['admin', 'doctor', 'patient'] },
    { to: '/my-appointments', label: 'My Appointments', key: 'myAppointments', roles: ['patient'] },
    { to: '/my-billing', label: 'Billing', key: 'myBilling', roles: ['patient'] },
    { to: '/my-receipts', label: 'Receipts', key: 'myReceipts', roles: ['patient'] },
    { to: '/prescriptions', label: 'Prescriptions', key: 'prescriptions', roles: ['patient'] },
    { to: '/availability', label: 'Availability', key: 'availability', roles: ['doctor'] },
    { to: '/doctor-attendance', label: 'Attendance', key: 'doctorAttendance', roles: ['doctor'] },
    { to: '/doctors', label: 'Doctors', key: 'doctors', roles: ['admin'] },
    { to: '/doctor-approvals', label: 'Doctor Approvals', key: 'doctorApprovals', roles: ['admin'] },
    { to: '/staff', label: 'Staff', key: 'staff', roles: ['admin'] },
    { to: '/wards', label: 'Wards', key: 'wards', roles: ['admin'] },
    { to: '/wards-live', label: 'Live Wards', key: 'wardsLive', roles: ['admin'] },
    { to: '/patients', label: 'Patients', key: 'patients', roles: ['admin', 'doctor'] },
    { to: '/shifts', label: 'Shifts', key: 'shifts', roles: ['admin'] },
    { to: '/attendance', label: 'Attendance', key: 'attendance', roles: ['admin'] },
    { to: '/doctor-attendance-board', label: 'Doctor Attendance', key: 'doctorAttendanceBoard', roles: ['admin'] },
    { to: '/leaves', label: 'Leaves', key: 'leaves', roles: ['admin'] },
    { to: '/prescription-templates', label: 'Templates', key: 'prescriptionTemplates', roles: ['doctor'] },
    { to: '/queries', label: 'Queries', key: 'queries', roles: ['admin'] },
]

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

const COLORS = [
    'from-indigo-500 to-violet-600',
    'from-emerald-500 to-teal-600',
    'from-blue-500 to-cyan-600',
    'from-rose-500 to-pink-600',
    'from-amber-500 to-orange-600'
]

const PlanCard = React.memo(({ p, idx, onEditClick, deletePlan }) => {
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: idx * 0.1 }}
            className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-lg transition-all duration-300 relative group"
        >
            <div className={`h-2 w-full bg-gradient-to-r ${COLORS[idx % COLORS.length]}`}></div>
            <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h3 className="text-xl font-bold text-slate-800">{p.name}</h3>
                        <p className="text-sm text-slate-500 line-clamp-2 mt-1">{p.description}</p>
                    </div>
                    <div className={`p-2 rounded-lg bg-gradient-to-br ${COLORS[idx % COLORS.length]} text-white shadow-sm`}>
                        <Layers size={20} />
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="text-xs font-semibold text-slate-400 uppercase mb-2 flex items-center gap-1"><DollarSign size={12} /> Pricing</div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                            {Object.entries(p.prices || {}).slice(0, 4).map(([k, v]) => (
                                <div key={k} className="flex justify-between">
                                    <span className="capitalize text-slate-500">{k.replace(/([A-Z])/g, ' $1').trim()}</span>
                                    <span className="font-semibold text-slate-700">₹{v / 100}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <div className="flex-1 p-3 bg-slate-50 rounded-xl border border-slate-100">
                            <div className="text-xs font-semibold text-slate-400 uppercase mb-1 flex items-center gap-1"><Users size={12} /> Limits</div>
                            <div className="text-xs text-slate-600 space-y-1">
                                <div className="flex justify-between"><span>Admins:</span> <span className="font-bold">{p.limits?.admins || 0}</span></div>
                                <div className="flex justify-between"><span>Sub-Admins:</span> <span className="font-bold">{p.limits?.subAdmins || 0}</span></div>
                                <div className="flex justify-between"><span>Doctors:</span> <span className="font-bold">{p.limits?.doctors || 0}</span></div>
                                <div className="flex justify-between"><span>Patients:</span> <span className="font-bold">{p.limits?.patients || 0}</span></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
                <button onClick={() => onEditClick(p)} className="p-2 hover:bg-white rounded-lg text-slate-500 hover:text-indigo-600 transition-colors border border-transparent hover:border-slate-200 shadow-none hover:shadow-sm">
                    <Edit3 size={18} />
                </button>
                <button onClick={() => deletePlan(p._id)} className="p-2 hover:bg-white rounded-lg text-slate-500 hover:text-red-600 transition-colors border border-transparent hover:border-slate-200 shadow-none hover:shadow-sm">
                    <Trash2 size={18} />
                </button>
            </div>
        </motion.div>
    )
})

export default function PlansPage() {
    useProfileRender('PlansPage', true);
    const { token } = useAuth()
    const [showForm, setShowForm] = useState(false)
    const [editingPlanId, setEditingPlanId] = useState(null)
    const [name, setName] = useState('')
    const [description, setDescription] = useState('')
    const [roleFeatures, setRoleFeatures] = useState({ admin: [], doctor: [], patient: [] })
    const [prices, setPrices] = useState({ month: '', threeMonths: '', year: '', fiveYears: '' })
    const [limits, setLimits] = useState({ admins: '', subAdmins: '', doctors: '', patients: '' })
    const [error, setError] = useState(null)

    const queryClient = useQueryClient()

    // Query
    const { data: plans = [], isLoading: plansLoading } = useQuery({
        queryKey: ['plansAll'],
        queryFn: async () => {
            const data = await authFetch(`/api/plans/all`)
            return data.plans || []
        },
        enabled: !!token
    })

    // Mutations
    const deletePlanMutation = useMutation({
        mutationFn: (id) => authFetch(`/api/plans/${id}`, { method: 'DELETE' }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['plansAll'] })
        },
        onError: () => {
            alert('Failed to delete')
        }
    })

    const savePlanMutation = useMutation({
        mutationFn: async (payload) => {
            if (editingPlanId) {
                return authFetch(`/api/plans/${editingPlanId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
            } else {
                return authFetch(`/api/plans`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['plansAll'] })
            setShowForm(false)
            setEditingPlanId(null)
            setName(''); setDescription(''); setRoleFeatures({ admin: [], doctor: [], patient: [] });
            setPrices({ month: '', threeMonths: '', year: '', fiveYears: '' })
            setLimits({ admins: '', subAdmins: '', doctors: '', patients: '' })
        },
        onError: (e) => {
            setError(e.message || 'Server error')
        }
    })

    const loading = savePlanMutation.isPending

    const toggleRoleFeature = useCallback((role, key) => {
        setRoleFeatures(prev => {
            const next = { ...prev }
            const currentList = next[role] || []
            const arr = new Set(currentList)
            if (arr.has(key)) arr.delete(key)
            else arr.add(key)
            next[role] = Array.from(arr)
            return next
        })
    }, [])

    const onSubmit = useCallback((e) => {
        e.preventDefault()
        setError(null)
        if (!name) return setError('Plan name is required')
        const payload = {
            name, description, roleFeatures,
            limits: Object.fromEntries(Object.entries(limits).map(([k, v]) => [k, v ? Number(v) : undefined])),
            prices: Object.fromEntries(Object.entries(prices).map(([k, v]) => [k, Math.round((parseFloat(v) || 0) * 100)]))
        }
        savePlanMutation.mutate(payload)
    }, [name, description, roleFeatures, limits, prices, savePlanMutation])

    const onEditClick = useCallback((plan) => {
        setEditingPlanId(plan._id)
        setName(plan.name || '')
        setDescription(plan.description || '')
        setRoleFeatures(plan.roleFeatures || { admin: [], doctor: [], patient: [] })
        setPrices(Object.fromEntries(Object.entries(plan.prices || {}).map(([k, v]) => [k, (v / 100).toString()])))
        setLimits(Object.fromEntries(Object.entries(plan.limits || {}).map(([k, v]) => [k, String(v)])))
        setShowForm(true)
    }, [])

    const deletePlan = useCallback((id) => {
        if (!confirm('Delete this plan immediately?')) return
        deletePlanMutation.mutate(id)
    }, [deletePlanMutation])

    const handleNewPlanClick = useCallback(() => {
        setShowForm(true)
        setEditingPlanId(null)
        setName('')
        setDescription('')
        setRoleFeatures({ admin: [], doctor: [], patient: [] })
        setPrices({ month: '', threeMonths: '', year: '', fiveYears: '' })
        setLimits({ admins: '', subAdmins: '', doctors: '', patients: '' })
    }, [])

    return (
        <div className="p-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Subscription Plans</h1>
                    <p className="text-slate-500">Manage pricing tiers and feature access.</p>
                </div>
                <button
                    onClick={handleNewPlanClick}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 shadow-md transition-all active:scale-95 font-medium"
                >
                    <Plus size={18} /> New Plan
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                <AnimatePresence>
                    {plans.map((p, idx) => (
                        <PlanCard
                            key={p._id}
                            p={p}
                            idx={idx}
                            onEditClick={onEditClick}
                            deletePlan={deletePlan}
                        />
                    ))}
                </AnimatePresence>
            </div>

            {/* Modal Form */}
            <AnimatePresence>
                {showForm && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowForm(false)}
                            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ translateY: 50, opacity: 0 }}
                            animate={{ translateY: 0, opacity: 1 }}
                            exit={{ translateY: 50, opacity: 0 }}
                            className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
                        >
                            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
                                <h2 className="text-xl font-bold text-slate-800">{editingPlanId ? 'Edit Plan' : 'Create New Plan'}</h2>
                                <button onClick={() => setShowForm(false)} className="p-1 rounded-md hover:bg-slate-100"><X size={24} /></button>
                            </div>

                            <div className="p-6 overflow-y-auto custom-scrollbar">
                                <form id="planForm" onSubmit={onSubmit} className="space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-4">
                                            <div>
                                                <label className="text-sm font-medium text-slate-700">Plan Name</label>
                                                <input value={name} onChange={e => setName(e.target.value)} className="w-full mt-1 px-4 py-2 border rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none" placeholder="e.g. Enterprise Tier" />
                                            </div>
                                            <div>
                                                <label className="text-sm font-medium text-slate-700">Description</label>
                                                <input value={description} onChange={e => setDescription(e.target.value)} className="w-full mt-1 px-4 py-2 border rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none" placeholder="Short summary..." />
                                            </div>

                                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                                <h4 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2"><DollarSign size={16} /> Pricing (₹)</h4>
                                                <div className="grid grid-cols-2 gap-3">
                                                    {['month', 'threeMonths', 'year', 'fiveYears'].map(k => (
                                                        <div key={k}>
                                                            <label className="text-xs text-slate-500 capitalize">{k.replace(/([A-Z])/g, ' $1')}</label>
                                                            <input
                                                                type="text"
                                                                value={prices[k] || ''}
                                                                onChange={e => setPrices(p => ({ ...p, [k]: e.target.value.replace(/[^0-9.]/g, '') }))}
                                                                className="w-full mt-1 px-3 py-1.5 border rounded-lg text-sm"
                                                                placeholder="0.00"
                                                            />
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-4">
                                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                                <h4 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2"><Users size={16} /> User Limits</h4>
                                                <div className="grid grid-cols-2 gap-3">
                                                    {['admins', 'subAdmins', 'doctors', 'patients'].map(k => (
                                                        <div key={k}>
                                                            <label className="text-xs text-slate-500 capitalize">{k.replace(/([A-Z])/g, ' $1')}</label>
                                                            <input
                                                                type="number"
                                                                value={limits[k] || ''}
                                                                onChange={e => setLimits(p => ({ ...p, [k]: e.target.value }))}
                                                                className="w-full mt-1 px-3 py-1.5 border rounded-lg text-sm"
                                                                placeholder="Unl"
                                                            />
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <h4 className="text-sm font-bold text-slate-700 mb-3">Feature Access</h4>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            {['admin', 'doctor', 'patient'].map(role => (
                                                <div key={role} className="border border-slate-200 rounded-xl p-4">
                                                    <h5 className="capitalize font-semibold text-slate-700 mb-3 border-b pb-2">{role} Features</h5>
                                                    <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-2">
                                                        {NAV.filter(n => n.roles.includes(role)).map(item => (
                                                            <label key={item.key} className="flex items-center gap-2 p-1.5 hover:bg-slate-50 rounded cursor-pointer transition-colors">
                                                                <input
                                                                    type="checkbox"
                                                                    className="rounded text-indigo-600 focus:ring-indigo-500"
                                                                    checked={(roleFeatures[role] || []).includes(item.key)}
                                                                    onChange={() => toggleRoleFeature(role, item.key)}
                                                                />
                                                                <span className="text-xs text-slate-600">{item.label}</span>
                                                            </label>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </form>
                            </div>

                            <div className="p-4 border-t border-slate-100 flex justify-end gap-3 bg-slate-50">
                                <button onClick={() => setShowForm(false)} className="px-5 py-2 text-slate-600 hover:bg-white border border-transparent hover:border-slate-200 rounded-xl transition-all font-medium">Cancel</button>
                                <button
                                    form="planForm"
                                    type="submit"
                                    disabled={loading}
                                    className="px-6 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 shadow-md transition-all font-medium flex items-center gap-2"
                                >
                                    {loading ? 'Saving...' : 'Save Plan'}
                                    <Check size={18} />
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    )
}
