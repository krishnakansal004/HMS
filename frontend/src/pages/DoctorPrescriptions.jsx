import { useProfileRender } from '../utils/profiler';
import { useEffect, useState, useMemo, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listDoctorPrescriptions, emailPrescription, updatePrescription, createPrescription, updateAppointment, listDoctorPatients } from '../services/api'
import { useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { Plus, Pill, User, Calendar, FileText, X, ChevronDown, ChevronUp, Mail, Eye, Pencil, Search } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import PageContainer from '../components/Admin/PageContainer'
import PageHeader from '../components/Admin/PageHeader'

const StatusBadge = ({ status }) => {
    const s = (status || 'pending').toLowerCase()
    const map = {
        issued: 'bg-emerald-50 text-emerald-700 border-emerald-100',
        paid: 'bg-blue-50 text-blue-700 border-blue-100',
        pending: 'bg-amber-50 text-amber-700 border-amber-100',
    }
    return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide border ${map[s] || map.pending}`}>{s}</span>
}

function PrescriptionDetailModal({ p, onClose, onEmail }) {
    const [sending, setSending] = useState(false)
    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
            <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                onClick={e => e.stopPropagation()}
                className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            >
                <div className="sticky top-0 bg-white/90 backdrop-blur-sm z-10 flex items-center justify-between p-5 border-b border-slate-100">
                    <div>
                        <h2 className="text-lg font-bold text-slate-800">Prescription Details</h2>
                        <p className="text-xs text-slate-500 mt-0.5">
                            Patient: <strong>{p.patientName || p.patient?.name || '—'}</strong> ·
                            {new Date(p.createdAt || p.date || Date.now()).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full"><X size={18} className="text-slate-500" /></button>
                </div>

                <div className="p-5 space-y-5">
                    {/* Medicines table */}
                    {(p.medicines || []).length > 0 ? (
                        <div>
                            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                <Pill size={12} /> Medicines Prescribed
                            </h4>
                            <div className="bg-slate-50 rounded-xl border border-slate-100 overflow-hidden">
                                <table className="w-full text-sm">
                                    <thead className="bg-slate-100 text-xs text-slate-500 font-semibold uppercase">
                                        <tr>
                                            <th className="px-4 py-3 text-left">Medicine</th>
                                            <th className="px-4 py-3 text-left">Dosage</th>
                                            <th className="px-4 py-3 text-left">Frequency</th>
                                            <th className="px-4 py-3 text-left">Duration</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {p.medicines.map((m, i) => (
                                            <tr key={i} className="hover:bg-slate-50">
                                                <td className="px-4 py-2.5 font-semibold text-slate-800">{m.name || '—'}</td>
                                                <td className="px-4 py-2.5 text-slate-600">{m.dosage || '—'}</td>
                                                <td className="px-4 py-2.5 text-slate-600">{m.frequency || '—'}</td>
                                                <td className="px-4 py-2.5 text-slate-600">{m.duration || '—'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ) : (
                        <div className="text-slate-400 text-sm italic">No medicines listed.</div>
                    )}

                    {p.tests && (
                        <div>
                            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5"><FileText size={12} /> Tests / Investigations</h4>
                            <p className="text-sm text-slate-700 bg-slate-50 rounded-xl border border-slate-100 p-3">{p.tests}</p>
                        </div>
                    )}

                    {p.notes && (
                        <div>
                            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5"><FileText size={12} /> Notes</h4>
                            <p className="text-sm text-slate-700 bg-slate-50 rounded-xl border border-slate-100 p-3 whitespace-pre-line">{p.notes}</p>
                        </div>
                    )}

                    {p.followUp && (
                        <div className="flex items-center gap-2 text-sm text-slate-600 bg-blue-50 rounded-lg p-3 border border-blue-100">
                            <Calendar size={14} className="text-blue-500" />
                            <span>Follow-up scheduled: <strong>{new Date(p.followUp).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}</strong></span>
                        </div>
                    )}

                    <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
                        <button
                            disabled={sending}
                            onClick={async () => {
                                const email = p.patientEmail || p.patient?.email
                                if (!email) return toast.warning('No patient email on file')
                                setSending(true)
                                try {
                                    await emailPrescription(p._id, { to: email, attachPdf: true })
                                    toast.success(`Prescription sent to ${email}`)
                                } catch (e) {
                                    toast.error(e?.message || 'Failed to send')
                                } finally { setSending(false) }
                            }}
                            className="flex items-center gap-2 px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-sm font-medium transition-colors"
                        >
                            <Mail size={14} /> {sending ? 'Sending...' : 'Email to Patient'}
                        </button>
                    </div>
                </div>
            </motion.div>
        </div>
    )
}

export default function DoctorPrescriptions() {
    useProfileRender('DoctorPrescriptions', true);
    const queryClient = useQueryClient()
    const [search, setSearch] = useState('')
    const [viewingPrescription, setViewingPrescription] = useState(null)
    const [showNewForm, setShowNewForm] = useState(false)
    const [newForm, setNewForm] = useState({
        patientId: '', patientName: '', patientEmail: '',
        medicines: [{ name: '', dosage: '', frequency: '', duration: '' }],
        notes: '', tests: '', followUp: ''
    })

    const location = useLocation()
    const navigate = useNavigate()

    // -- Queries --
    const { data: list = [], isLoading, refetch } = useQuery({
        queryKey: ['doctorPrescriptions'],
        queryFn: listDoctorPrescriptions,
        refetchInterval: 5000,
    })

    const { data: patients = [] } = useQuery({
        queryKey: ['doctorPatients'],
        queryFn: listDoctorPatients,
    })

    useEffect(() => {
        const qs = new URLSearchParams(location.search)
        const pId = qs.get('patientId')
        const pName = qs.get('patientName')
        const pEmail = qs.get('patientEmail')

        if (pName) {
            setShowNewForm(true)
            setNewForm(f => ({
                ...f,
                patientId: pId || '',
                patientName: pName,
                patientEmail: pEmail || ''
            }))
            // Clear search params to prevent loop/re-runs
            navigate(location.pathname, { replace: true })
        }
    }, [location.search, location.pathname, navigate])

    // -- Mutations --
    const createPrescriptionMutation = useMutation({
        mutationFn: (payload) => createPrescription(payload),
        onSuccess: async (data, variables) => {
            const qs = new URLSearchParams(location.search)
            const apptId = qs.get('appointmentId')
            if (apptId) {
                try { await updateAppointment(apptId, { status: 'completed' }) } catch (_) { }
            }
            toast.success('Prescription created and saved')
            setShowNewForm(false)
            setNewForm({ patientId: '', patientName: '', patientEmail: '', medicines: [{ name: '', dosage: '', frequency: '', duration: '' }], notes: '', tests: '', followUp: '' })
            queryClient.invalidateQueries({ queryKey: ['doctorPrescriptions'] })
        },
        onError: (e) => {
            console.error('[Prescriptions] Backend validation/request error:', e);
            toast.error(e?.message || 'Failed to create prescription')
        }
    })

    const filtered = useMemo(() => {
        return list.filter(p => {
            if (!search) return true
            const q = search.toLowerCase()
            return (
                (p.patientName || '').toLowerCase().includes(q) ||
                (p.patientEmail || '').toLowerCase().includes(q) ||
                (p.medicines || []).some(m => (m.name || '').toLowerCase().includes(q))
            )
        })
    }, [list, search])

    const addMedicineRow = useCallback(() => {
        setNewForm(f => ({ ...f, medicines: [...f.medicines, { name: '', dosage: '', frequency: '', duration: '' }] }))
    }, [])

    const removeMedicineRow = useCallback((i) => {
        setNewForm(f => ({ ...f, medicines: f.medicines.filter((_, idx) => idx !== i) }))
    }, [])

    const updateMed = useCallback((i, field, val) => {
        setNewForm(f => {
            const meds = [...f.medicines]
            meds[i] = { ...meds[i], [field]: val }
            return { ...f, medicines: meds }
        })
    }, [])

    const handleCreate = useCallback((e) => {
        e.preventDefault()
        console.log('[Prescriptions] Outgoing payload:', {
            ...newForm,
            patientId: newForm.patientId || undefined
        })
        if (!newForm.patientId) {
            console.warn('[Prescriptions] Patient selection missing');
            return toast.warning('Please select an assigned patient')
        }
        if (!newForm.patientName) {
            console.warn('[Prescriptions] Patient name missing');
            return toast.warning('Patient name required')
        }
        createPrescriptionMutation.mutate({
            ...newForm,
            patientId: newForm.patientId || undefined
        })
    }, [newForm, createPrescriptionMutation])

    return (
        <PageContainer>
            <PageHeader
                title="Prescriptions"
                breadcrumbs={[{ label: 'Dashboard', to: '/' }, { label: 'Prescriptions' }]}
                actions={
                    <button
                        className="flex items-center gap-2 btn btn-primary px-4 py-2.5"
                        onClick={() => setShowNewForm(true)}
                    >
                        <Plus size={18} /> New Prescription
                    </button>
                }
            />

            {/* Search */}
            <div className="mb-5 relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
                <input
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-sm"
                    placeholder="Search by patient name, email or medicine..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
            </div>

            {/* List */}
            {isLoading ? (
                <div className="text-center text-slate-500 py-20">Loading...</div>
            ) : list.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-16 text-center">
                    <Pill size={40} className="mx-auto text-slate-300 mb-4" />
                    <p className="text-slate-700 font-medium">No prescriptions yet</p>
                    <p className="text-slate-400 text-sm mt-1">Prescriptions you create for patients will appear here.</p>
                    <button className="mt-5 btn btn-primary" onClick={() => setShowNewForm(true)}>
                        <Plus size={16} className="mr-1" /> Create First Prescription
                    </button>
                </div>
            ) : (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                    <div className="p-3 bg-slate-50 border-b border-slate-100 text-xs font-semibold text-slate-500">
                        {filtered.length} prescription{filtered.length !== 1 ? 's' : ''} {search && `matching "${search}"`}
                    </div>
                    <div className="divide-y divide-slate-50">
                        {filtered.map(p => (
                            <div key={p._id} className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50/70 transition-colors group">
                                {/* Avatar */}
                                <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs border border-blue-200 flex-shrink-0">
                                    {(p.patientName || p.patient?.name || '?').charAt(0).toUpperCase()}
                                </div>

                                {/* Main info */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-semibold text-slate-800">{p.patientName || (p.patient && (p.patient.firstName + ' ' + (p.patient.lastName || ''))) || '—'}</span>
                                        <StatusBadge status={p.pharmacyStatus} />
                                    </div>
                                    <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-3 flex-wrap">
                                        <span className="flex items-center gap-1">
                                            <Calendar size={10} />
                                            {new Date(p.createdAt || p.date || Date.now()).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <Pill size={10} />
                                            {(p.medicines || []).length} medicine{(p.medicines || []).length !== 1 ? 's' : ''}:&nbsp;
                                            {(p.medicines || []).slice(0, 3).map(m => m.name).filter(Boolean).join(', ') || 'None'}
                                            {(p.medicines || []).length > 3 && ` +${p.medicines.length - 3} more`}
                                        </span>
                                        {p.patientEmail && <span className="text-slate-400">{p.patientEmail}</span>}
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => setViewingPrescription(p)}
                                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                        title="View details"
                                    >
                                        <Eye size={15} />
                                    </button>
                                    <button
                                        onClick={async () => {
                                            const email = p.patientEmail || p.patient?.email
                                            if (!email) return toast.warning('No patient email on file')
                                            try {
                                                await emailPrescription(p._id, { to: email, attachPdf: true })
                                                toast.success(`Sent to ${email}`)
                                            } catch (e) { toast.error('Failed to send') }
                                        }}
                                        className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                        title="Email to patient"
                                    >
                                        <Mail size={15} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* View prescription modal */}
            <AnimatePresence>
                {viewingPrescription && (
                    <PrescriptionDetailModal
                        p={viewingPrescription}
                        onClose={() => setViewingPrescription(null)}
                    />
                )}
            </AnimatePresence>

            {/* New Prescription Form Modal */}
            <AnimatePresence>
                {showNewForm && (
                    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowNewForm(false)}>
                        <motion.div
                            initial={{ opacity: 0, scale: 0.96 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.96 }}
                            onClick={e => e.stopPropagation()}
                            className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
                        >
                            <div className="sticky top-0 bg-white/90 backdrop-blur-sm z-10 flex items-center justify-between p-5 border-b border-slate-100">
                                <h2 className="text-lg font-bold text-slate-800">New Prescription</h2>
                                <button onClick={() => setShowNewForm(false)} className="p-2 hover:bg-slate-100 rounded-full"><X size={18} /></button>
                            </div>

                            <form onSubmit={handleCreate} className="p-5 space-y-5">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="label">Select Assigned Patient *</label>
                                        <select
                                            className="input"
                                            value={newForm.patientId || ''}
                                            onChange={e => {
                                                const selectedId = e.target.value
                                                const patient = patients.find(p => (p.patientId || p._id || p.key) === selectedId)
                                                if (patient) {
                                                    setNewForm(f => ({
                                                        ...f,
                                                        patientId: patient.patientId || patient._id || selectedId,
                                                        patientName: patient.name || patient.displayName || '',
                                                        patientEmail: patient.email || ''
                                                    }))
                                                } else {
                                                    setNewForm(f => ({
                                                        ...f,
                                                        patientId: '',
                                                        patientName: '',
                                                        patientEmail: ''
                                                    }))
                                                }
                                            }}
                                            required
                                        >
                                            <option value="">-- Choose Patient --</option>
                                            {patients.map(p => {
                                                const val = p.patientId || p._id || p.key
                                                return (
                                                    <option key={val} value={val}>
                                                        {p.name || p.displayName || 'Unknown'} ({p.email || 'No email'})
                                                    </option>
                                                )
                                            })}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="label">Patient Email (Auto-filled)</label>
                                        <input 
                                            className="input bg-slate-50 cursor-not-allowed" 
                                            type="email" 
                                            value={newForm.patientEmail} 
                                            readOnly 
                                            placeholder="Patient email"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="label mb-0">Medicines</label>
                                        <button type="button" onClick={addMedicineRow} className="text-xs flex items-center gap-1 text-blue-600 hover:text-blue-700 font-medium">
                                            <Plus size={13} /> Add Medicine
                                        </button>
                                    </div>
                                    <div className="space-y-2">
                                        {newForm.medicines.map((m, i) => (
                                            <div key={i} className="grid grid-cols-4 gap-2 p-3 bg-slate-50 rounded-xl border border-slate-100">
                                                <input className="input col-span-2" placeholder="Medicine name" value={m.name} onChange={e => updateMed(i, 'name', e.target.value)} />
                                                <input className="input" placeholder="Dosage" value={m.dosage} onChange={e => updateMed(i, 'dosage', e.target.value)} />
                                                <div className="flex gap-1">
                                                    <input className="input flex-1" placeholder="Freq" value={m.frequency} onChange={e => updateMed(i, 'frequency', e.target.value)} />
                                                    {newForm.medicines.length > 1 && (
                                                        <button type="button" onClick={() => removeMedicineRow(i)} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                                                            <X size={13} />
                                                        </button>
                                                    )}
                                                </div>
                                                <input className="input col-span-4" placeholder="Duration (e.g. 5 days)" value={m.duration} onChange={e => updateMed(i, 'duration', e.target.value)} />
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="label">Tests / Investigations</label>
                                        <textarea className="input" rows={2} placeholder="e.g. CBC, Blood Sugar" value={newForm.tests} onChange={e => setNewForm(f => ({ ...f, tests: e.target.value }))} />
                                    </div>
                                    <div>
                                        <label className="label">Follow-up Date</label>
                                        <input className="input" type="date" value={newForm.followUp} onChange={e => setNewForm(f => ({ ...f, followUp: e.target.value }))} />
                                    </div>
                                </div>

                                <div>
                                    <label className="label">Notes / Instructions</label>
                                    <textarea className="input" rows={3} placeholder="Dietary advice, rest, special instructions..." value={newForm.notes} onChange={e => setNewForm(f => ({ ...f, notes: e.target.value }))} />
                                </div>

                                <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
                                    <button type="button" onClick={() => setShowNewForm(false)} className="btn btn-ghost">Cancel</button>
                                    <button type="submit" disabled={createPrescriptionMutation.isPending} className="btn btn-primary">
                                        {createPrescriptionMutation.isPending ? 'Creating...' : 'Create Prescription'}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </PageContainer>
    )
}

