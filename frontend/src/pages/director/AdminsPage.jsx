import { useProfileRender } from '../../utils/profiler';
import React, { useState, useCallback } from 'react'
import { useAuth } from '../../context/AuthContext'
import { authFetch } from '../../services/api'
import { useNavigate } from 'react-router-dom'
import {
    Search, User, Mail, Phone, Building, Lock,
    Unlock, Trash2, Edit2, CheckCircle, XCircle,
    Shield, UserPlus, Copy, Check, CreditCard, ShieldAlert,
    Clock, ExternalLink, RefreshCw, Info
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

const AdminRow = React.memo(({ a, i, revealPassword, setEditingAdmin, openDetails, toggleBlock, deleteAdmin }) => {
    return (
        <motion.tr
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="hover:bg-slate-50/80 transition-colors"
        >
            <td className="px-6 py-4">
                <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shadow-sm ${a.blocked ? 'bg-slate-400' : 'bg-gradient-to-br from-indigo-500 to-violet-600'}`}>
                        {a.name?.charAt(0) || 'A'}
                    </div>
                    <div>
                        <div className="font-medium text-slate-800">{a.name}</div>
                        <div className="text-xs text-slate-500 flex items-center gap-1">
                            <Mail size={11} /> {a.email}
                        </div>
                    </div>
                </div>
            </td>
            <td className="px-6 py-4 text-sm text-slate-600">
                <div className="flex items-center gap-2">
                    <Phone size={14} className="text-slate-400" />
                    {a.phone || '—'}
                </div>
            </td>
            <td className="px-6 py-4">
                <div className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
                        <Building size={13} className="text-slate-400" />
                        {a.hospitalName || '—'}
                    </span>
                    {a.plan?.name && (
                        <span className="text-xs inline-flex items-center px-1.5 py-0.5 rounded border border-indigo-100 bg-indigo-50 text-indigo-700 w-fit">
                            {a.plan.name}
                        </span>
                    )}
                </div>
            </td>
            <td className="px-6 py-4">
                {a.paymentPending ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 text-amber-600 text-xs font-bold border border-amber-200">
                        <Clock size={11} /> Payment Pending
                    </span>
                ) : a.blocked ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-bold border border-slate-200">
                        <XCircle size={11} /> Blocked
                    </span>
                ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600 text-xs font-bold border border-emerald-100">
                        <CheckCircle size={11} /> Active
                    </span>
                )}
            </td>
            <td className="px-6 py-4 text-right">
                <div className="flex items-center justify-end gap-2 text-slate-400">
                    {a.paymentShortUrl && (
                        <a
                            href={a.paymentShortUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 hover:bg-slate-100 rounded-lg hover:text-emerald-600 transition-colors"
                            title="Open payment link"
                        >
                            <ExternalLink size={15} />
                        </a>
                    )}
                    {a.setupUrl && (
                        <div className="flex items-center gap-2 bg-indigo-50 px-2 py-1 rounded border border-indigo-100 max-w-xs mr-2">
                            <input
                                readOnly
                                value={a.setupUrl}
                                className="bg-transparent text-indigo-700 font-mono text-xs outline-none w-28 truncate"
                                onClick={e => { e.target.select(); navigator.clipboard.writeText(a.setupUrl) }}
                            />
                            <span className="text-[10px] text-indigo-600/80 uppercase font-bold whitespace-nowrap">Setup Link</span>
                        </div>
                    )}
                    {!a.setupUrl && (
                        <button onClick={() => revealPassword(a.id)} className="p-1.5 hover:bg-slate-100 rounded-lg hover:text-indigo-600 transition-colors" title="Reset Password">
                            <Lock size={16} />
                        </button>
                    )}
                    <button onClick={() => setEditingAdmin(a)} className="p-1.5 hover:bg-slate-100 rounded-lg hover:text-blue-600 transition-colors" title="Edit">
                        <Edit2 size={16} />
                    </button>
                    <button onClick={() => openDetails(a.id)} className="p-1.5 hover:bg-slate-100 rounded-lg hover:text-indigo-600 transition-colors" title="Info">
                        <Info size={16} />
                    </button>
                    <button onClick={() => toggleBlock(a.id, a.blocked)} className={`p-1.5 hover:bg-slate-100 rounded-lg transition-colors ${a.blocked ? 'text-emerald-500 hover:text-emerald-600' : 'hover:text-amber-600'}`} title={a.blocked ? 'Unblock' : 'Block'}>
                        {a.blocked ? <Unlock size={16} /> : <Shield size={16} />}
                    </button>
                    <button onClick={() => deleteAdmin(a.id)} className="p-1.5 hover:bg-red-50 rounded-lg hover:text-red-600 transition-colors" title="Delete">
                        <Trash2 size={16} />
                    </button>
                </div>
            </td>
        </motion.tr>
    )
})

export default function AdminsPage() {
    useProfileRender('AdminsPage', true);
    const { token } = useAuth()
    const navigate = useNavigate()
    const [q, setQ] = useState('')
    const [searchQuery, setSearchQuery] = useState('')
    
    const [editingAdmin, setEditingAdmin] = useState(null)
    const [editError, setEditError] = useState(null)

    // Admin Details Modal
    const [detailsId, setDetailsId] = useState(null)

    // Add Admin modal state
    const [showAddModal, setShowAddModal] = useState(false)
    const [addForm, setAddForm] = useState({ name: '', email: '', phone: '', hospitalName: '', planId: '', period: 'monthly', requestedAmount: '' })
    const [addError, setAddError] = useState(null)
    const [addResult, setAddResult] = useState(null) // success result with paymentShortUrl
    
    // Action Confirmation Modal
    const [confirmAction, setConfirmAction] = useState(null) // { type, id, name }
    const [copied, setCopied] = useState(false)

    const queryClient = useQueryClient()

    // Queries
    const { data: admins = [], isLoading: loading, error: adminsError } = useQuery({
        queryKey: ['directorAdmins', searchQuery],
        queryFn: () => authFetch(`/api/director/admins${searchQuery ? `?q=${encodeURIComponent(searchQuery)}` : ''}`),
        enabled: !!token
    })

    const { data: plans = [], isLoading: plansLoading } = useQuery({
        queryKey: ['plansAll'],
        queryFn: async () => {
            try {
                const data = await authFetch('/api/plans/all')
                return data.plans || []
            } catch (e) {
                try {
                    const data = await authFetch('/api/plans')
                    return data.plans || []
                } catch (e2) {
                    return []
                }
            }
        },
        enabled: !!token
    })

    const { data: detailsData, isLoading: detailsLoading, error: detailsError } = useQuery({
        queryKey: ['adminDetails', detailsId],
        queryFn: () => authFetch(`/api/director/admins/${detailsId}/details`),
        enabled: !!detailsId && !!token
    })

    // Mutations
    const confirmActionMutation = useMutation({
        mutationFn: async ({ type, id }) => {
            if (type === 'block' || type === 'unblock') {
                return authFetch(`/api/director/admins/${id}/${type}`, { method: 'POST' })
            } else if (type === 'delete') {
                return authFetch(`/api/director/admins/${id}`, { method: 'DELETE' })
            } else if (type === 'reveal') {
                return authFetch(`/api/director/admins/${id}/reveal`, { method: 'POST' })
            } else if (type === 'confirmPaid') {
                return authFetch(`/api/director/admins/${id}/confirm-paid`, { method: 'POST' })
            }
        },
        onSuccess: (data, variables) => {
            const { type } = variables
            if (type === 'confirmPaid') {
                if (data?.mailMode === 'credentials-queued') {
                    alert('✅ Payment confirmed! Admin activated. Credentials email is queued.')
                } else {
                    alert('✅ Payment confirmed! Admin activated.')
                }
            }
            queryClient.invalidateQueries({ queryKey: ['directorAdmins'] })
            setConfirmAction(null)
        },
        onError: (err) => {
            alert('Action failed: ' + (err.message || 'Unknown error'))
        }
    })

    const saveEditMutation = useMutation({
        mutationFn: (admin) => authFetch(`/api/director/admins/${admin.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: admin.name, email: admin.email, phone: admin.phone })
        }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['directorAdmins'] })
            setEditingAdmin(null)
        },
        onError: (err) => {
            setEditError(err.message)
        }
    })

    const submitAddAdminMutation = useMutation({
        mutationFn: (payload) => authFetch('/api/director/admins', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        }),
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['directorAdmins'] })
            setAddResult(data)
        },
        onError: (err) => {
            if (err?.status === 409) {
                const errData = err?.data || {}
                if (errData.alreadyExists) {
                    setAddError(errData.error || 'This email/phone is already taken.')
                    if (errData.paymentShortUrl) {
                        setAddResult({
                            ...errData,
                            email: addForm.email,
                            paymentPending: true
                        })
                    }
                } else {
                    setAddError(err.message || 'This email already has an account.')
                }
            } else {
                setAddError(err.message || 'Failed to create admin')
            }
        }
    })

    const editLoading = saveEditMutation.isPending
    const addLoading = submitAddAdminMutation.isPending

    const error = adminsError?.status === 401
        ? 'Session expired. Please login again as Director.'
        : adminsError?.message

    const onSearch = useCallback((e) => {
        e.preventDefault()
        setSearchQuery(q)
    }, [q])

    const toggleBlock = useCallback((id, isBlocked) => {
        setConfirmAction({ type: isBlocked ? 'unblock' : 'block', id, name: admins.find(a => String(a.id) === String(id))?.name })
    }, [admins])

    const deleteAdmin = useCallback((id) => {
        setConfirmAction({ type: 'delete', id, name: admins.find(a => String(a.id) === String(id))?.name })
    }, [admins])

    const revealPassword = useCallback((id) => {
        setConfirmAction({ type: 'reveal', id, name: admins.find(a => String(a.id) === String(id))?.name })
    }, [admins])

    const confirmPayment = useCallback((id) => {
        setConfirmAction({ type: 'confirmPaid', id, name: admins.find(a => String(a.id) === String(id))?.name })
    }, [admins])

    const handleConfirmAction = useCallback(() => {
        if (!confirmAction) return
        confirmActionMutation.mutate({ type: confirmAction.type, id: confirmAction.id })
    }, [confirmAction, confirmActionMutation])

    const saveEdit = useCallback((e) => {
        e.preventDefault()
        if (!editingAdmin) return
        setEditError(null)
        saveEditMutation.mutate(editingAdmin)
    }, [editingAdmin, saveEditMutation])

    const openDetails = useCallback((id) => {
        setDetailsId(id)
    }, [])

    const openAddModal = useCallback(() => {
        setAddForm({ name: '', email: '', phone: '', hospitalName: '', planId: '', period: 'monthly', requestedAmount: '' })
        setAddError(null)
        setAddResult(null)
        setCopied(false)
        setShowAddModal(true)
    }, [])

    const closeAddModal = useCallback(() => {
        setShowAddModal(false)
        setAddResult(null)
        setAddError(null)
    }, [])

    const getSelectedPlan = useCallback(() => {
        return plans.find(p => String(p._id || p.id) === addForm.planId) || null
    }, [plans, addForm.planId])

    const getPlanPriceDisplay = useCallback(() => {
        const plan = getSelectedPlan()
        if (!plan || !plan.prices) return null
        const px = plan.prices
        switch (addForm.period) {
            case '3months': return px.threeMonths ? `₹${px.threeMonths / 100}/3 months` : null
            case 'yearly': return px.year || px.yearly ? `₹${(px.year || px.yearly) / 100}/year` : null
            case '5years': return px.fiveYears ? `₹${px.fiveYears / 100}/5 years` : null
            default: return px.month ? `₹${px.month / 100}/month` : null
        }
    }, [getSelectedPlan, addForm.period])

    const submitAddAdmin = useCallback((e) => {
        e.preventDefault()
        if (addLoading) return
        setAddError(null)
        if (!addForm.name.trim()) { setAddError('Name is required'); return }
        if (!addForm.email.trim()) { setAddError('Email is required'); return }
        const payload = { ...addForm }
        if (!payload.planId) delete payload.planId
        if (!payload.requestedAmount) delete payload.requestedAmount
        submitAddAdminMutation.mutate(payload)
    }, [addForm, addLoading, submitAddAdminMutation])

    const copyText = useCallback((text) => {
        navigator.clipboard.writeText(text).then(() => {
            setCopied(true)
            setTimeout(() => setCopied(false), 2500)
        })
    }, [])

    const selectedPlanPrice = getPlanPriceDisplay()

    return (
        <div className="p-4 md:p-10 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Manage Admins</h1>
                    <p className="text-slate-500 text-sm">Oversee hospital administrators and their access.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={openAddModal}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl shadow-sm transition-colors"
                    >
                        <UserPlus size={16} />
                        Add Admin
                    </button>
                    <form onSubmit={onSearch} className="relative w-full sm:w-72">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                            value={q}
                            onChange={e => setQ(e.target.value)}
                            placeholder="Search admins..."
                            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all shadow-sm text-sm"
                        />
                    </form>
                </div>
            </div>

            {error && <div className="p-4 bg-red-50 text-red-600 rounded-xl border border-red-100 text-sm">{error}</div>}

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[1000px]">
                        <thead>
                            <tr className="bg-slate-50/50 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                <th className="px-6 py-4">Name / Email</th>
                                <th className="px-6 py-4">Contact</th>
                                <th className="px-6 py-4">Hospital / Plan</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            <AnimatePresence>
                                {loading ? (
                                    <tr><td colSpan={5} className="p-8 text-center text-slate-400">Loading...</td></tr>
                                ) : admins.length === 0 ? (
                                    <tr><td colSpan={5} className="p-8 text-center text-slate-400">No admins found.</td></tr>
                                                ) : admins.map((a, i) => (
                                    <AdminRow
                                        key={a.id || i}
                                        a={a}
                                        i={i}
                                        revealPassword={revealPassword}
                                        setEditingAdmin={setEditingAdmin}
                                        openDetails={openDetails}
                                        toggleBlock={toggleBlock}
                                        deleteAdmin={deleteAdmin}
                                    />
                                ))
                            }
                            </AnimatePresence>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ─── Add Admin Modal ─────────────────────────────────────────────── */}
            <AnimatePresence>
                {showAddModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={closeAddModal} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
                        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="relative w-full max-w-xl bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden max-h-[90vh] overflow-y-auto">

                            <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-indigo-50 to-violet-50 flex justify-between items-center sticky top-0 z-10">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center"><UserPlus size={16} className="text-white" /></div>
                                    <h3 className="font-semibold text-slate-800">Add New Admin</h3>
                                </div>
                                <button onClick={closeAddModal} className="text-slate-400 hover:text-slate-600 transition-colors"><XCircle size={20} /></button>
                            </div>

                            {addResult ? (
                                /* ── Success state ── */
                                <div className="p-6 space-y-4">
                                    <div className="flex items-start gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                                        <CheckCircle size={20} className="text-emerald-600 shrink-0 mt-0.5" />
                                        <div>
                                            <h3 className="text-2xl font-bold text-slate-800 mb-2">
                                                {addResult.alreadyExists ? 'Account Found' : 'Admin Created Successfully!'}
                                            </h3>
                                            {addResult.paymentPending ? (
                                                <p className="text-xs text-emerald-700 mt-0.5">A payment link has been sent to <strong>{addResult.email}</strong>. After payment is made, their account will be automatically activated and their credentials sent.</p>
                                            ) : (
                                                <p className="text-xs text-emerald-700 mt-0.5">A setup email has been sent to <strong>{addResult.email}</strong>.</p>
                                            )}
                                        </div>
                                    </div>

                                    {addResult.paymentShortUrl && (
                                        <div>
                                            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">Payment Link (Share with Admin)</label>
                                            <div className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                                                <input readOnly value={addResult.paymentShortUrl} className="flex-1 bg-transparent text-indigo-700 font-mono text-xs outline-none truncate" onClick={e => e.target.select()} />
                                                <button onClick={() => copyText(addResult.paymentShortUrl)} className={`shrink-0 p-1.5 rounded-lg transition-all ${copied ? 'bg-emerald-100 text-emerald-600' : 'hover:bg-slate-200 text-slate-500'}`} title="Copy">
                                                    {copied ? <Check size={14} /> : <Copy size={14} />}
                                                </button>
                                                <a href={addResult.paymentShortUrl} target="_blank" rel="noopener noreferrer" className="shrink-0 p-1.5 rounded-lg hover:bg-slate-200 text-slate-500 transition-all" title="Open payment link">
                                                    <ExternalLink size={14} />
                                                </a>
                                            </div>
                                            <p className="text-xs text-slate-400 mt-1.5">After the admin completes the payment, their account will be automatically activated and their credentials will be emailed to them.</p>
                                        </div>
                                    )}

                                    {addResult.setupUrl && (
                                        <div>
                                            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">Setup Link (Share with Admin)</label>
                                            <div className="flex items-center gap-2 p-3 bg-indigo-50 border border-indigo-100 rounded-xl">
                                                <input readOnly value={addResult.setupUrl} className="flex-1 bg-transparent text-indigo-700 font-mono text-xs outline-none truncate" onClick={e => e.target.select()} />
                                                <button onClick={() => copyText(addResult.setupUrl)} className={`shrink-0 p-1.5 rounded-lg transition-all ${copied ? 'bg-emerald-100 text-emerald-600' : 'hover:bg-indigo-200 text-indigo-500'}`} title="Copy">
                                                    {copied ? <Check size={14} /> : <Copy size={14} />}
                                                </button>
                                                <a href={addResult.setupUrl} target="_blank" rel="noopener noreferrer" className="shrink-0 p-1.5 rounded-lg hover:bg-indigo-200 text-indigo-500 transition-all" title="Open setup link">
                                                    <ExternalLink size={14} />
                                                </a>
                                            </div>
                                            <p className="text-xs text-slate-400 mt-1.5">This unique link allows the admin to set their password and access their portal immediately.</p>
                                        </div>
                                    )}

                                    <div className="flex justify-end gap-3 pt-2">
                                        <button onClick={() => { setAddResult(null); setAddForm({ name: '', email: '', phone: '', hospitalName: '', planId: '', period: 'monthly', requestedAmount: '' }) }}
                                            className="px-4 py-2 text-sm font-medium text-indigo-600 border border-indigo-200 hover:bg-indigo-50 rounded-xl transition-colors">
                                            Add Another
                                        </button>
                                        <button onClick={closeAddModal} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm transition-colors">Done</button>
                                    </div>
                                </div>
                            ) : (
                                /* ── Form state ── */
                                <form onSubmit={submitAddAdmin} className="p-6 space-y-4">
                                    {addError && <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl flex items-center gap-2"><XCircle size={16} /> {addError}</div>}

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        {/* Name */}
                                        <div className="space-y-1.5">
                                            <label className="text-sm font-medium text-slate-700">Full Name <span className="text-red-500">*</span></label>
                                            <div className="relative">
                                                <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                                <input className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none transition-all text-slate-700 text-sm" placeholder="Dr. John Smith" value={addForm.name} onChange={e => setAddForm(p => ({ ...p, name: e.target.value }))} required />
                                            </div>
                                        </div>
                                        {/* Email */}
                                        <div className="space-y-1.5">
                                            <label className="text-sm font-medium text-slate-700">Email Address <span className="text-red-500">*</span></label>
                                            <div className="relative">
                                                <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                                <input type="email" className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none transition-all text-slate-700 text-sm" placeholder="admin@hospital.com" value={addForm.email} onChange={e => setAddForm(p => ({ ...p, email: e.target.value }))} required />
                                            </div>
                                        </div>
                                        {/* Phone */}
                                        <div className="space-y-1.5">
                                            <label className="text-sm font-medium text-slate-700">Phone Number</label>
                                            <div className="relative">
                                                <Phone size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                                <input type="tel" className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none transition-all text-slate-700 text-sm" placeholder="+91 9876543210" value={addForm.phone} onChange={e => setAddForm(p => ({ ...p, phone: e.target.value }))} />
                                            </div>
                                        </div>
                                        {/* Hospital Name */}
                                        <div className="space-y-1.5">
                                            <label className="text-sm font-medium text-slate-700">Hospital / Clinic Name</label>
                                            <div className="relative">
                                                <Building size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                                <input className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none transition-all text-slate-700 text-sm" placeholder="City General Hospital" value={addForm.hospitalName} onChange={e => setAddForm(p => ({ ...p, hospitalName: e.target.value }))} />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Plan Selection */}
                                    <div className="pt-2 border-t border-slate-100">
                                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Plan & Payment</p>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div className="space-y-1.5">
                                                <label className="text-sm font-medium text-slate-700">Select Plan</label>
                                                <select
                                                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none transition-all text-slate-700 text-sm bg-white"
                                                    value={addForm.planId}
                                                    onChange={e => setAddForm(p => ({ ...p, planId: e.target.value }))}
                                                >
                                                    <option value="">— No Plan / Manual —</option>
                                                    {plans.map(plan => (
                                                        <option key={plan._id || plan.id} value={plan._id || plan.id}>{plan.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-sm font-medium text-slate-700">Billing Period</label>
                                                <select
                                                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none transition-all text-slate-700 text-sm bg-white"
                                                    value={addForm.period}
                                                    onChange={e => setAddForm(p => ({ ...p, period: e.target.value }))}
                                                    disabled={!addForm.planId}
                                                >
                                                    <option value="monthly">Monthly</option>
                                                    <option value="3months">3 Months</option>
                                                    <option value="yearly">Yearly</option>
                                                    <option value="5years">5 Years</option>
                                                </select>
                                            </div>
                                        </div>

                                        {selectedPlanPrice && (
                                            <div className="mt-2 px-3 py-2 bg-indigo-50 border border-indigo-100 rounded-xl text-sm text-indigo-700 font-medium">
                                                💳 Plan price: <strong>{selectedPlanPrice}</strong>
                                            </div>
                                        )}

                                        {/* Custom amount if no plan selected */}
                                        {!addForm.planId && (
                                            <div className="mt-3 space-y-1.5">
                                                <label className="text-sm font-medium text-slate-700">Custom Amount (₹) <span className="text-slate-400 font-normal">optional</span></label>
                                                <input type="number" min="0" className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none transition-all text-slate-700 text-sm" placeholder="e.g. 2999" value={addForm.requestedAmount} onChange={e => setAddForm(p => ({ ...p, requestedAmount: e.target.value }))} />
                                            </div>
                                        )}

                                        <p className="text-xs text-slate-400 mt-2">
                                            {addForm.planId ? 'A Razorpay payment link will be generated and emailed to the admin. After payment, click "Confirm Paid" to activate their account.' : 'No payment link will be generated. You can manually confirm payment later.'}
                                        </p>
                                    </div>

                                    <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
                                        <button type="button" onClick={closeAddModal} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-xl transition-colors">Cancel</button>
                                        <button type="submit" disabled={addLoading} className="px-5 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 rounded-xl shadow-sm transition-all flex items-center gap-2">
                                            {addLoading ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Creating...</> : <><UserPlus size={15} /> Create Admin</>}
                                        </button>
                                    </div>
                                </form>
                            )}
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* ─── Edit Modal ───────────────────────────────────────────────────── */}
            <AnimatePresence>
                {/* Action Confirmation Modal */}
            {confirmAction && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[9999]">
                    <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden border border-gray-100 animate-in fade-in zoom-in duration-200">
                        <div className={`p-6 ${confirmAction.type === 'delete' ? 'bg-red-50' : 'bg-blue-50'}`}>
                            <div className="flex items-center gap-4">
                                <div className={`p-3 rounded-full ${confirmAction.type === 'delete' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                                    {confirmAction.type === 'delete' ? <Trash2 size={24} /> : confirmAction.type === 'reveal' ? <Lock size={24} /> : <ShieldAlert size={24} />}
                                </div>
                                <h3 className="text-xl font-bold text-gray-900">
                                    {confirmAction.type === 'delete' ? 'Delete Admin?' : confirmAction.type === 'reveal' ? 'Setup Password Link?' : confirmAction.type === 'confirmPaid' ? 'Confirm Payment?' : `${confirmAction.type === 'block' ? 'Block' : 'Unblock'} Admin?`}
                                </h3>
                            </div>
                        </div>
                        <div className="p-6">
                            <p className="text-gray-600 mb-6">
                                {confirmAction.type === 'delete' ? (
                                    <>Are you sure you want to delete <strong>{confirmAction.name}</strong>? This action is irreversible and will wipe all associated tenant data.</>
                                ) : confirmAction.type === 'reveal' ? (
                                    <>Do you want to generate a secure password setup link for <strong>{confirmAction.name}</strong>? This will invalidate any old tokens.</>
                                ) : confirmAction.type === 'confirmPaid' ? (
                                    <>Has payment been received for <strong>{confirmAction.name}</strong>? This will activate their hospital account and send their login credentials.</>
                                ) : (
                                    <>Do you want to {confirmAction.type} <strong>{confirmAction.name}</strong>? They will be {confirmAction.type === 'block' ? 'locked out of their account' : 'able to log in again'}.</>
                                )}
                            </p>
                            <div className="flex gap-3 justify-end">
                                <button
                                    onClick={() => setConfirmAction(null)}
                                    disabled={confirmAction.loading}
                                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleConfirmAction}
                                    disabled={confirmAction.loading}
                                    className={`px-4 py-2 rounded-lg text-white font-medium shadow-sm transition-all flex items-center gap-2 ${confirmAction.type === 'delete' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'} disabled:opacity-50`}
                                >
                                    {confirmAction.loading ? (
                                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                        confirmAction.type === 'delete' ? 'Delete' : 'Confirm'
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {editingAdmin && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setEditingAdmin(null)} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
                        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="relative w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
                            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                                <h3 className="font-semibold text-slate-800">Edit Administrator</h3>
                                <button onClick={() => setEditingAdmin(null)} className="text-slate-400 hover:text-slate-600"><XCircle size={20} /></button>
                            </div>
                            <form onSubmit={saveEdit} className="p-6 space-y-4">
                                {editError && <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg">{editError}</div>}
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium text-slate-700">Full Name</label>
                                    <input className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all text-slate-700 text-sm" value={editingAdmin.name || ''} onChange={e => setEditingAdmin(p => ({ ...p, name: e.target.value }))} />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium text-slate-700">Email Address</label>
                                    <input className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all text-slate-700 text-sm" value={editingAdmin.email || ''} onChange={e => setEditingAdmin(p => ({ ...p, email: e.target.value }))} />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium text-slate-700">Phone Number</label>
                                    <input className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all text-slate-700 text-sm" value={editingAdmin.phone || ''} onChange={e => setEditingAdmin(p => ({ ...p, phone: e.target.value }))} />
                                </div>
                                <div className="flex justify-end gap-3 mt-6 pt-2">
                                    <button type="button" onClick={() => setEditingAdmin(null)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-xl transition-colors">Cancel</button>
                                    <button type="submit" disabled={editLoading} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm transition-colors flex items-center gap-2">
                                        {editLoading ? 'Saving...' : 'Save Changes'}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {detailsId && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDetailsId(null)} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
                        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="relative w-full max-w-lg bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden max-h-[90vh] overflow-y-auto">
                            <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-indigo-50 to-violet-50 flex justify-between items-center sticky top-0 z-10">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center"><Info size={16} className="text-white" /></div>
                                    <h3 className="font-semibold text-slate-800">Admin Details</h3>
                                </div>
                                <button onClick={() => setDetailsId(null)} className="text-slate-400 hover:text-slate-600 transition-colors"><XCircle size={20} /></button>
                            </div>

                            <div className="p-6 space-y-6">
                                {detailsLoading ? (
                                    <div className="flex items-center gap-3 text-slate-500 justify-center py-6">
                                        <div className="w-5 h-5 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" /> Fetching details...
                                    </div>
                                ) : detailsError ? (
                                    <div className="p-4 bg-red-50 text-red-600 rounded-xl border border-red-100 text-sm flex items-start gap-2">
                                        <XCircle size={16} className="shrink-0 mt-0.5" />
                                        {detailsError}
                                    </div>
                                ) : detailsData ? (
                                    <>
                                        {/* Core Info */}
                                        <div className="flex items-center gap-4 border-b border-slate-100 pb-4">
                                            <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-sm bg-gradient-to-br from-indigo-500 to-violet-600 shrink-0">
                                                {detailsData.name?.charAt(0) || 'A'}
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-slate-800 text-lg">{detailsData.name}</h4>
                                                <p className="text-sm text-slate-500">{detailsData.email}</p>
                                            </div>
                                        </div>

                                        <div className="space-y-4">
                                            {/* Attributes Grid */}
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-1">
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Joining Date</span>
                                                    <div className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
                                                        <Clock size={14} className="text-slate-400" />
                                                        {new Date(detailsData.joiningDate).toLocaleDateString()}
                                                    </div>
                                                </div>
                                                <div className="space-y-1">
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Expiry Date</span>
                                                    <div className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
                                                        <Clock size={14} className="text-slate-400" />
                                                        {detailsData.subscriptionEnd ? new Date(detailsData.subscriptionEnd).toLocaleDateString() : 'N/A'}
                                                    </div>
                                                </div>
                                                <div className="space-y-1">
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Plan Taken</span>
                                                    <div className="text-sm font-medium text-slate-700 mt-0.5">
                                                        {detailsData.plan ? (
                                                            <span className="inline-flex items-center px-2 py-0.5 rounded border border-indigo-100 bg-indigo-50 text-indigo-700 text-xs shadow-sm">
                                                                {detailsData.plan.name}
                                                            </span>
                                                        ) : <span className="text-slate-500 italic">None</span>}
                                                    </div>
                                                </div>
                                                <div className="space-y-1">
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Personal URL</span>
                                                    <div className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
                                                        <ExternalLink size={14} className="text-indigo-400" />
                                                        {detailsData.publicUrl ? (
                                                            <a href={detailsData.publicUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline truncate underline-offset-2">
                                                                {detailsData.publicUrl}
                                                            </a>
                                                        ) : <span className="text-slate-500 italic">Unassigned</span>}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Limits block */}
                                            <div className="pt-4 border-t border-slate-100">
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3 block">Subscription Utilization</span>
                                                <div className="grid grid-cols-2 gap-4">
                                                    {/* Doctor limits */}
                                                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex flex-col items-center justify-center relative overflow-hidden group">
                                                        <div className="absolute top-0 w-full h-1 bg-gradient-to-r from-blue-400 to-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                        <span className="text-xs font-semibold text-slate-500 mb-1 flex items-center gap-1"><User size={12} /> Doctors</span>
                                                        <div className="text-2xl font-black text-slate-800 tracking-tight">
                                                            {detailsData.usage.doctorsCount} <span className="text-base font-medium text-slate-400">/ {detailsData.plan?.limits?.doctors || '∞'}</span>
                                                        </div>
                                                    </div>

                                                    {/* Patient limits */}
                                                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex flex-col items-center justify-center relative overflow-hidden group">
                                                        <div className="absolute top-0 w-full h-1 bg-gradient-to-r from-emerald-400 to-teal-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                        <span className="text-xs font-semibold text-slate-500 mb-1 flex items-center gap-1"><User size={12} /> Patients</span>
                                                        <div className="text-2xl font-black text-slate-800 tracking-tight">
                                                            {detailsData.usage.patientsCount} <span className="text-base font-medium text-slate-400">/ {detailsData.plan?.limits?.patients || '∞'}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex justify-end pt-2">
                                            <button onClick={() => setDetailsId(null)} className="px-5 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm transition-colors">
                                                Close
                                            </button>
                                        </div>
                                    </>
                                ) : null}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    )
}
