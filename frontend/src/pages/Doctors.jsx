import { useProfileRender } from '../utils/profiler';
import React, { useState, useMemo, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { listDoctors, createDoctor, updateDoctor, deleteDoctor, getMyTenant, markDoctorAttendance } from '../services/api'
import { Plus, Edit, Trash2, Search, X } from 'lucide-react'
import { toast } from 'react-toastify'
import { motion, AnimatePresence } from 'framer-motion'
import PageContainer from '../components/Admin/PageContainer'
import PageHeader from '../components/Admin/PageHeader'
import VirtualizedTable from '../components/common/VirtualizedTable'

function DoctorForm({ initial, onClose, onSaved }) {
    const isEdit = !!initial
    const queryClient = useQueryClient()
    const [form, setForm] = useState(initial || {
        name: '', email: '', specialization: 'General Physician', phone: '',
        department: '', experienceYears: '', qualifications: '', address: '',
        consultationFee: '', availability: '', password: '', registrationNumber: ''
    })
    const saveDoctorMutation = useMutation({
        mutationFn: (formData) => isEdit ? updateDoctor(initial._id, formData) : createDoctor(formData),
        onMutate: async (formData) => {
            const queryKeys = queryClient.getQueryCache().findAll({ queryKey: ['doctors'] })
            const cacheBackup = queryKeys.map(q => ({ queryKey: q.queryKey, data: q.state.data }))

            queryKeys.forEach(q => {
                queryClient.setQueryData(q.queryKey, old => {
                    const arr = Array.isArray(old) ? old : []
                    if (isEdit) {
                        return arr.map(d => (d._id === initial._id || d.id === initial._id) ? { ...d, ...formData } : d)
                    } else {
                        return [...arr, { _id: 'temp-id-' + Date.now(), ...formData }]
                    }
                })
            })

            onClose()
            return { cacheBackup }
        },
        onError: (err, formData, context) => {
            if (context?.cacheBackup) {
                context.cacheBackup.forEach(b => {
                    queryClient.setQueryData(b.queryKey, b.data)
                })
            }
            toast.error(err.message || 'Failed to save doctor')
        },
        onSuccess: () => {
            toast.success(isEdit ? 'Doctor updated' : 'Doctor created')
            onSaved()
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['doctors'] })
        }
    })

    const handleSubmit = (e) => {
        e.preventDefault()
        saveDoctorMutation.mutate(form)
    }

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
                >
                    <div className="flex items-center justify-between p-6 border-b border-slate-100">
                        <h2 className="text-xl font-bold text-slate-800">{isEdit ? 'Edit Doctor Profile' : 'Add Doctor'}</h2>
                        <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-50 rounded-lg">
                            <X size={18} />
                        </button>
                    </div>
                    <form onSubmit={handleSubmit} className="p-6 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                                <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="input w-full border border-slate-200 rounded-xl px-4 py-2" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
                                <input type="email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} disabled={isEdit} className="input w-full border border-slate-200 rounded-xl px-4 py-2 disabled:bg-slate-50" />
                            </div>
                            {!isEdit && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                                    <input type="password" required value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} className="input w-full border border-slate-200 rounded-xl px-4 py-2" />
                                </div>
                            )}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Phone Number</label>
                                <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="input w-full border border-slate-200 rounded-xl px-4 py-2" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Specialization</label>
                                <select value={form.specialization} onChange={e => setForm({ ...form, specialization: e.target.value })} className="input w-full border border-slate-200 rounded-xl px-4 py-2">
                                    <option value="General Physician">General Physician</option>
                                    <option value="Cardiologist">Cardiologist</option>
                                    <option value="Dermatologist">Dermatologist</option>
                                    <option value="Pediatrician">Pediatrician</option>
                                    <option value="Neurologist">Neurologist</option>
                                    <option value="Gynecologist">Gynecologist</option>
                                    <option value="Orthopedic">Orthopedic</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Department</label>
                                <input required value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} className="input w-full border border-slate-200 rounded-xl px-4 py-2" placeholder="e.g. Cardiology, Pediatrics" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Registration Number</label>
                                <input value={form.registrationNumber || ''} onChange={e => setForm({ ...form, registrationNumber: e.target.value })} className="input w-full border border-slate-200 rounded-xl px-4 py-2" placeholder="e.g. MC-12345" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Experience (Years)</label>
                                <input type="number" value={form.experienceYears} onChange={e => setForm({ ...form, experienceYears: e.target.value })} className="input w-full border border-slate-200 rounded-xl px-4 py-2" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Consultation Fee</label>
                                <input type="number" required value={form.consultationFee} onChange={e => setForm({ ...form, consultationFee: e.target.value })} className="input w-full border border-slate-200 rounded-xl px-4 py-2" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Qualifications</label>
                            <input value={form.qualifications} onChange={e => setForm({ ...form, qualifications: e.target.value })} className="input w-full border border-slate-200 rounded-xl px-4 py-2" placeholder="MBBS, MD" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
                            <textarea value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} className="input w-full border border-slate-200 rounded-xl px-4 py-2" rows="2" />
                        </div>
                        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                            <button type="button" onClick={onClose} className="px-4 py-2 border border-slate-200 rounded-xl hover:bg-slate-50">Cancel</button>
                            <button type="submit" disabled={saveDoctorMutation.isPending} className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50">
                                {saveDoctorMutation.isPending ? 'Saving...' : 'Save Profile'}
                            </button>
                        </div>
                    </form>
                </motion.div>
            </div>
        </AnimatePresence>
    )
}

const DoctorRow = React.memo(({ d, setEditing, setShowForm, setConfirmingDelete, markAtt }) => {
    return (
        <tr className="hover:bg-slate-50/80 transition-colors group">
            <td className="px-6 py-4 font-semibold text-slate-800">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                        {d.name?.charAt(0)}
                    </div>
                    <div>
                        <div className="font-semibold text-slate-800">{d.name}</div>
                        <div className="text-xs text-slate-500 font-normal">{d.specialization}</div>
                    </div>
                </div>
            </td>
            <td className="px-6 py-4 text-slate-600">
                <div>{d.email}</div>
                <div className="text-xs text-slate-500">{d.phone || 'No phone'}</div>
            </td>
            <td className="px-6 py-4 font-medium text-slate-700">₹{d.consultationFee}</td>
            <td className="px-6 py-4">
                <div className="flex items-center gap-2">
                    <button onClick={() => markAtt(d._id, 'present')} className="px-2 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded text-xs font-semibold">Present</button>
                    <button onClick={() => markAtt(d._id, 'absent')} className="px-2 py-1 bg-red-50 text-red-700 hover:bg-red-100 rounded text-xs font-semibold">Absent</button>
                </div>
            </td>
            <td className="px-6 py-4 text-center">
                <div className="flex items-center justify-center gap-2">
                    <button onClick={() => { setEditing(d); setShowForm(true) }} className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg">
                        <Edit size={16} />
                    </button>
                    <button onClick={() => setConfirmingDelete({ id: d._id, name: d.name })} className="p-2 text-red-600 hover:bg-red-50 rounded-lg">
                        <Trash2 size={16} />
                    </button>
                </div>
            </td>
        </tr>
    )
})

export default function Doctors() {
    useProfileRender('Doctors', true);
    const navigate = useNavigate()
    const [page, setPage] = useState(1)
    const limit = 25
    const [q, setQ] = useState('')
    const [editing, setEditing] = useState(null)
    const [showForm, setShowForm] = useState(false)
    const [confirmingDelete, setConfirmingDelete] = useState(null)

    const { data: rawDoctors, isLoading: loading, refetch: fetchDoctors } = useQuery({
        queryKey: ['doctors', page],
        queryFn: () => listDoctors({ page, limit }),
    })

    const doctors = useMemo(() => Array.isArray(rawDoctors) ? rawDoctors : [], [rawDoctors])

    const { data: tenantData } = useQuery({
        queryKey: ['tenant'],
        queryFn: getMyTenant
    })
    const tenant = tenantData?.tenant || null
    const canCreate = useMemo(() => {
        if (!tenant) return true
        if (tenant.plan?.limits?.doctors == null) return true
        return (tenant.usage?.doctors || 0) < tenant.plan.limits.doctors
    }, [tenant])

    const filtered = useMemo(() => {
        return doctors.filter(d =>
            (d.name || '').toLowerCase().includes(q.toLowerCase()) ||
            (d.specialization || '').toLowerCase().includes(q.toLowerCase())
        )
    }, [doctors, q])

    const hasMore = doctors.length === limit

    const queryClient = useQueryClient()

    const { mutate: deleteDoctorMutate } = useMutation({
        mutationFn: (id) => deleteDoctor(id, { hard: true }),
        onMutate: async (id) => {
            const queryKeys = queryClient.getQueryCache().findAll({ queryKey: ['doctors'] })
            const cacheBackup = queryKeys.map(q => ({ queryKey: q.queryKey, data: q.state.data }))

            queryKeys.forEach(q => {
                queryClient.setQueryData(q.queryKey, old => {
                    const arr = Array.isArray(old) ? old : []
                    return arr.filter(d => d._id !== id && d.id !== id)
                })
            })

            setConfirmingDelete(null)
            return { cacheBackup }
        },
        onError: (err, id, context) => {
            if (context?.cacheBackup) {
                context.cacheBackup.forEach(b => {
                    queryClient.setQueryData(b.queryKey, b.data)
                })
            }
            toast.error(err.message || 'Failed to remove doctor')
        },
        onSuccess: () => {
            toast.success('Doctor removed')
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['doctors'] })
        }
    })

    const executeDelete = useCallback(() => {
        if (!confirmingDelete) return
        deleteDoctorMutate(confirmingDelete.id)
    }, [confirmingDelete, deleteDoctorMutate])

    const { mutate: markAttendanceMutate } = useMutation({
        mutationFn: ({ id, status }) => markDoctorAttendance({
            doctorId: id,
            status,
            date: new Date().toISOString().split('T')[0]
        }),
        onSuccess: (_, variables) => {
            toast.success(`Marked as ${variables.status}`)
        },
        onError: () => {
            toast.error('Failed to mark attendance')
        }
    })

    const markAtt = useCallback((id, status) => {
        markAttendanceMutate({ id, status })
    }, [markAttendanceMutate])

    return (
        <PageContainer>
            <PageHeader
                title="Doctors"
                breadcrumbs={[{ label: 'Dashboard', to: '/' }, { label: 'Doctors' }]}
                actions={
                    <button
                        onClick={() => {
                            if (!canCreate) {
                                if (tenant?.subscriptionEnd && new Date() >= new Date(tenant.subscriptionEnd)) {
                                    navigate('/director/queryforplan')
                                    return
                                }
                                toast.info('Doctor limit reached. Upgrade plan.')
                                return
                            }
                            setEditing(null); setShowForm(true)
                        }}
                        className={`flex items-center gap-2 btn btn-primary ${!canCreate ? 'opacity-60 cursor-not-allowed' : ''}`}
                    >
                        <Plus size={18} /> Add Doctor
                    </button>
                }
            />

            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col h-[calc(100vh-12rem)] md:h-auto overflow-hidden">
                <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                    <div className="relative max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium"
                            placeholder="Search doctors..."
                            value={q}
                            onChange={e => setQ(e.target.value)}
                        />
                    </div>
                </div>

                <div className="table-responsive flex-1 overflow-x-auto">
                    {loading ? (
                        <div className="p-8 text-center text-slate-500">Loading doctors...</div>
                    ) : filtered.length === 0 ? (
                        <div className="p-8 text-center text-slate-500">No doctors found.</div>
                    ) : (
                        <VirtualizedTable
                            items={filtered}
                            rowHeight={72}
                            viewportHeight={400}
                            colSpan={5}
                            className="min-w-[900px]"
                            headers={
                                <tr>
                                    <th className="px-6 py-4">Profile</th>
                                    <th className="px-6 py-4">Specialization</th>
                                    <th className="px-6 py-4">Contact</th>
                                    <th className="px-6 py-4">Availability</th>
                                    <th className="px-6 py-4 text-center">Actions</th>
                                </tr>
                            }
                            renderRow={(d) => (
                                <DoctorRow
                                    key={d._id || d.id}
                                    d={d}
                                    markAtt={markAtt}
                                    setEditing={setEditing}
                                    setShowForm={setShowForm}
                                    setConfirmingDelete={setConfirmingDelete}
                                />
                            )}
                        />
                    )}
                </div>

                {/* Pagination Controls */}
                <div className="p-4 border-t border-slate-100 flex items-center justify-between text-sm bg-slate-50/50">
                    <div className="text-slate-500">Page {page}</div>
                    <div className="flex gap-2">
                        <button 
                            className="btn btn-sm btn-ghost" 
                            onClick={() => setPage(p => Math.max(1, p - 1))} 
                            disabled={loading || page === 1}
                        >
                            Previous
                        </button>
                        <button 
                            className="btn btn-sm btn-ghost" 
                            onClick={() => setPage(p => p + 1)} 
                            disabled={loading || !hasMore}
                        >
                            Next
                        </button>
                    </div>
                </div>
            </div>

            <AnimatePresence>
                {showForm && (
                    <DoctorForm
                        initial={editing}
                        onClose={() => setShowForm(false)}
                        onSaved={() => { setShowForm(false); fetchDoctors() }}
                        canCreate={canCreate}
                    />
                )}
            </AnimatePresence>

            {/* Delete Confirmation Modal */}
            <AnimatePresence>
                {confirmingDelete && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setConfirmingDelete(null)} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
                        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="relative w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
                            <div className="p-6 text-center">
                                <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Trash2 size={32} />
                                </div>
                                <h3 className="text-xl font-bold text-slate-800 mb-2">Delete Doctor?</h3>
                                <p className="text-slate-600 mb-6">Are you sure you want to remove <strong>{confirmingDelete.name}</strong>? This will permanently delete their profile and all associated records. This action cannot be undone.</p>
                                <div className="flex gap-3">
                                    <button onClick={() => setConfirmingDelete(null)} className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition-colors">Cancel</button>
                                    <button onClick={executeDelete} className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl shadow-lg shadow-red-200 transition-all hover:scale-[1.02] active:scale-95">Delete Permanently</button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </PageContainer>
    )
}

