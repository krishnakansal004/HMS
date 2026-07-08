import { useProfileRender } from '../utils/profiler';
import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getMyTenant, listSubadmins, createSubadmin, deleteSubadmin, updateSubadmin, resendSubadminCredentials } from '../services/api'
import { toast } from 'react-toastify'
import { useAuth } from '../context/AuthContext'
import { allNav } from '../constants/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Shield, Plus, Trash2, Search, X, Pencil, Mail, AlertTriangle } from 'lucide-react'
import PageContainer from '../components/Admin/PageContainer'
import PageHeader from '../components/Admin/PageHeader'

export default function SubadminFeature() {
    useProfileRender('SubadminFeature', true);
    const { user } = useAuth()
    const [tenant, setTenant] = useState(null)
    const [loading, setLoading] = useState(true)
    const [subadmins, setSubadmins] = useState([])
    const [showForm, setShowForm] = useState(false)
    const [searchQ, setSearchQ] = useState('')
    const [editTarget, setEditTarget] = useState(null) // subadmin being edited
    const [deleteTarget, setDeleteTarget] = useState(null) // { id, name }
    const [resendingId, setResendingId] = useState(null)

    // Form
    const emptyForm = { name: '', email: '', phone: '', designation: '', features: new Set() }
    const [form, setForm] = useState(emptyForm)
    const { hospitalSlug } = useParams()
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        let mounted = true
        setLoading(true)

        const fetchTenant = async () => {
            try {
                // Priority 1: If we have a hospitalSlug in URL, fetch that tenant
                if (hospitalSlug) {
                    const res = await getMyTenant(hospitalSlug)
                    if (mounted && res?.tenant) {
                        setTenant(res.tenant)
                        return
                    }
                }

                // Priority 2: Try fetching current user's own tenant
                const res = await getMyTenant()
                if (mounted && res?.tenant) {
                    setTenant(res.tenant)
                    return
                }

                // Fallback: Use user object's tenant properties if available
                if (mounted && user?.tenantId) {
                    setTenant({ _id: user.tenantId, name: user.tenantName || 'Your Hospital', plan: {} })
                }
            } catch (e) {
                console.error('Failed to load tenant context', e)
                if (mounted && user?.tenantId) {
                    setTenant({ _id: user.tenantId, name: user.tenantName || 'Your Hospital', plan: {} })
                }
            } finally {
                if (mounted) setLoading(false)
            }
        }

        fetchTenant()
        return () => { mounted = false }
    }, [user, hospitalSlug])

    const loadList = async (q = '') => {
        if (!tenant || !tenant._id) return
        try {
            const items = await listSubadmins(tenant._id, q)
            setSubadmins(Array.isArray(items) ? items : [])
        } catch (e) { toast.error('Failed to load subadmins') }
    }

    useEffect(() => { if (tenant && tenant._id) loadList('') }, [tenant])

    const availableFeatures = (allNav || []).filter(i => i.roles && i.roles.includes('admin')).map(i => i.label)

    const openCreate = () => {
        setEditTarget(null)
        setForm(emptyForm)
        setShowForm(true)
    }

    const openEdit = (s) => {
        setEditTarget(s)
        setForm({
            name: s.name || '',
            email: s.email || '',
            phone: s.phone || '',
            designation: s.designation || '',
            features: new Set(Array.isArray(s.features) ? s.features : [])
        })
        setShowForm(true)
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!form.name || !form.email) return toast.warning('Name and email required')

        setSaving(true)
        try {
            const tenantId = tenant?._id || user?.tenantId
            if (!tenantId) throw new Error('No tenant ID')
            const payload = { ...form, features: Array.from(form.features) }

            if (editTarget) {
                // Update existing subadmin
                await updateSubadmin(tenantId, editTarget._id, payload)
                toast.success('Subadmin updated successfully')
            } else {
                // Create new subadmin (auto-generates and emails credentials)
                payload.password = Math.random().toString(36).slice(-10)
                await createSubadmin(tenantId, payload)
                toast.success('Subadmin created and credentials emailed ✉️')
            }

            setShowForm(false)
            setEditTarget(null)
            setForm(emptyForm)
            loadList('')
        } catch (e) {
            if (e.status === 409) {
                toast.error('Email already registered in the system. Please use a unique email.')
            } else {
                toast.error(e.message || 'Failed to save subadmin')
            }
        }
        finally { setSaving(false) }
    }

    const handleDelete = async () => {
        if (!deleteTarget || !tenant || !tenant._id) return
        try {
            await deleteSubadmin(tenant._id, deleteTarget.id)
            toast.success('Subadmin deleted')
            setDeleteTarget(null)
            loadList(searchQ)
        } catch (e) { toast.error('Failed to delete') }
    }

    const handleResendCredentials = async (s) => {
        setResendingId(s._id)
        try {
            await resendSubadminCredentials(tenant._id, s._id)
            toast.success(`Credentials resent to ${s.email} ✉️`)
        } catch (e) {
            toast.error(e.message || 'Failed to resend credentials')
        } finally {
            setResendingId(null)
        }
    }

    const canCreate = (() => {
        try {
            if (!tenant?.plan?.limits) return true
            return (tenant.usage?.subAdmins || 0) < (tenant.plan.limits.subAdmins || 0)
        } catch (e) { return true }
    })()

    return (
        <PageContainer>
            <PageHeader
                title="Sub-Admins"
                breadcrumbs={[{ label: 'Dashboard', to: '/' }, { label: 'Sub-Admins' }]}
                actions={
                    <button
                        onClick={() => {
                            if (!canCreate) {
                                toast.info('Subadmin limit reached. Upgrade plan.')
                                return
                            }
                            openCreate()
                        }}
                        className={`flex items-center gap-2 btn btn-primary ${!canCreate ? 'opacity-60 cursor-not-allowed' : ''}`}
                    >
                        <Plus size={18} /> Add Subadmin
                    </button>
                }
            />

            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col h-[calc(100vh-12rem)] md:h-auto overflow-hidden">
                <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-4">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                            value={searchQ}
                            onChange={e => { setSearchQ(e.target.value); loadList(e.target.value) }}
                            placeholder="Search subadmins..."
                            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium"
                        />
                    </div>
                </div>

                <div className="overflow-auto flex-1">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-50 sticky top-0 z-10 text-xs font-bold text-slate-500 uppercase tracking-wider">
                            <tr>
                                <th className="px-6 py-4">Name</th>
                                <th className="px-6 py-4">Contact</th>
                                <th className="px-6 py-4">Access Features</th>
                                <th className="px-6 py-4 text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {loading ? (
                                <tr><td colSpan={4} className="p-8 text-center text-slate-500">Loading...</td></tr>
                            ) : subadmins.length === 0 ? (
                                <tr><td colSpan={4} className="p-8 text-center text-slate-500">No subadmins found.</td></tr>
                            ) : subadmins.map(s => (
                                <tr key={s._id} className="hover:bg-slate-50/80 transition-colors group">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-sm">
                                                {s.name?.charAt(0)}
                                            </div>
                                            <div>
                                                <div className="font-semibold text-slate-800">{s.name}</div>
                                                <div className="text-xs text-slate-500">{s.designation || 'SubAdmin'}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-sm text-slate-600">{s.email}</div>
                                        <div className="text-xs text-slate-500">{s.phone}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-wrap gap-1 max-w-xs">
                                            {(s.features || []).slice(0, 4).map(f => (
                                                <span key={f} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">{f}</span>
                                            ))}
                                            {(s.features || []).length > 4 && <span className="text-[10px] px-1.5 py-0.5 text-slate-400">+{s.features.length - 4} more</span>}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center justify-center gap-1">
                                            {/* Edit */}
                                            <button
                                                className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                                title="Edit subadmin"
                                                onClick={() => openEdit(s)}
                                            >
                                                <Pencil size={15} />
                                            </button>
                                            {/* Resend credentials */}
                                            <button
                                                className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors disabled:opacity-40"
                                                title="Resend login credentials"
                                                disabled={resendingId === s._id}
                                                onClick={() => handleResendCredentials(s)}
                                            >
                                                {resendingId === s._id
                                                    ? <div className="w-4 h-4 border-2 border-emerald-400/30 border-t-emerald-600 rounded-full animate-spin" />
                                                    : <Mail size={15} />
                                                }
                                            </button>
                                            {/* Delete */}
                                            <button
                                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                title="Delete subadmin"
                                                onClick={() => setDeleteTarget({ id: s._id, name: s.name })}
                                            >
                                                <Trash2 size={15} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Create / Edit Modal */}
            <AnimatePresence>
                {showForm && (
                    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden"
                        >
                            <div className="flex items-center justify-between p-6 border-b border-slate-100">
                                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                    <Shield size={20} className="text-blue-600" />
                                    {editTarget ? 'Edit Subadmin' : 'New Subadmin'}
                                </h2>
                                <button onClick={() => { setShowForm(false); setEditTarget(null) }} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                                    <X size={20} className="text-slate-500" />
                                </button>
                            </div>
                            <form onSubmit={handleSubmit} className="p-6 space-y-4">
                                <div><label className="label">Name *</label><input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required /></div>
                                <div>
                                    <label className="label">Email *</label>
                                    <input className="input" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required disabled={!!editTarget} />
                                    {editTarget && <p className="text-xs text-slate-400 mt-1">Email cannot be changed after creation</p>}
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div><label className="label">Phone</label><input className="input" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
                                    <div><label className="label">Designation</label><input className="input" value={form.designation} onChange={e => setForm({ ...form, designation: e.target.value })} /></div>
                                </div>
                                <div>
                                    <label className="label mb-2 block">Grant Access</label>
                                    <div className="max-h-40 overflow-y-auto border rounded-xl p-3 grid grid-cols-2 gap-2 bg-slate-50">
                                        {availableFeatures.map(f => (
                                            <label key={f} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={form.features.has(f)}
                                                    onChange={() => {
                                                        const s = new Set(form.features)
                                                        if (s.has(f)) s.delete(f)
                                                        else s.add(f)
                                                        setForm({ ...form, features: s })
                                                    }}
                                                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                                />
                                                {f}
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                {!editTarget && (
                                    <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-sm text-blue-700">
                                        📧 Login credentials will be automatically emailed to the subadmin.
                                    </div>
                                )}

                                <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 mt-2">
                                    <button type="button" onClick={() => { setShowForm(false); setEditTarget(null) }} className="btn btn-ghost">Cancel</button>
                                    <button type="submit" disabled={saving} className="btn btn-primary">
                                        {saving ? 'Saving...' : (editTarget ? 'Save Changes' : 'Create & Invite')}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Delete Confirmation Modal */}
            <AnimatePresence>
                {deleteTarget && (
                    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6"
                        >
                            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <AlertTriangle size={24} className="text-red-600" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-800 text-center">Delete Subadmin?</h3>
                            <p className="text-sm text-slate-500 text-center mt-2">
                                Permanently delete <strong>{deleteTarget.name}</strong>? They will lose all access immediately.
                            </p>
                            <div className="flex gap-3 mt-6">
                                <button onClick={() => setDeleteTarget(null)} className="flex-1 px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium transition-colors">
                                    Cancel
                                </button>
                                <button onClick={handleDelete} className="flex-1 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium transition-colors">
                                    Yes, Delete
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </PageContainer>
    )
}

