import { useProfileRender } from '../utils/profiler';
import { useState, useMemo } from 'react'
import { getMyPrescriptions, listPrescriptions, hidePrescription } from '../services/api'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'react-toastify'
import { Pill, User, Calendar, CheckCircle, Clock, FileText, ShoppingCart, Trash2, X, ChevronDown, ChevronUp } from 'lucide-react'
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
    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wide border ${map[s] || map.pending}`}>
            {s === 'issued' || s === 'paid' ? <CheckCircle size={11} /> : <Clock size={11} />}
            {s}
        </span>
    )
}

function PrescriptionCard({ p, onHide, onBuy }) {
    const [expanded, setExpanded] = useState(false)

    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden"
        >
            {/* Header row */}
            <div className="p-5 flex items-start gap-4">
                {/* Doctor avatar */}
                <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm flex-shrink-0 border border-blue-200">
                    DR
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div>
                            <div className="font-bold text-slate-800">Dr. {p.doctor?.name || p.doctorName || 'Unknown'}</div>
                            <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                                <Calendar size={11} />
                                {new Date(p.createdAt || p.date || Date.now()).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}
                                {(p.createdAt || p.date) && (
                                    <span className="ml-1">{new Date(p.createdAt || p.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                )}
                            </div>
                        </div>
                        <StatusBadge status={p.pharmacyStatus} />
                    </div>

                    {/* Medicine preview chips */}
                    <div className="mt-3 flex flex-wrap gap-1.5">
                        {(p.medicines || []).slice(0, 4).map((m, i) => (
                            <span key={i} className="text-xs bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg border border-slate-200 font-medium flex items-center gap-1">
                                <Pill size={10} className="text-indigo-500" />
                                {m.name}
                                {m.dosage && <span className="opacity-60 text-[10px]">{m.dosage}</span>}
                            </span>
                        ))}
                        {(p.medicines || []).length > 4 && (
                            <span className="text-xs text-slate-400 px-2 py-1">+{p.medicines.length - 4} more</span>
                        )}
                        {(!p.medicines || p.medicines.length === 0) && (
                            <span className="text-xs text-slate-400 italic">No medicines listed</span>
                        )}
                    </div>
                </div>

                {/* Toggle expand */}
                <button
                    onClick={() => setExpanded(e => !e)}
                    className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500 flex-shrink-0"
                    title={expanded ? 'Collapse' : 'View full prescription'}
                >
                    {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </button>
            </div>

            {/* Expanded full prescription */}
            <AnimatePresence>
                {expanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="border-t border-slate-100 p-5 bg-slate-50/50 space-y-5">
                            {/* Full medicines table */}
                            {(p.medicines || []).length > 0 && (
                                <div>
                                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                        <Pill size={12} /> Prescribed Medicines
                                    </h4>
                                    <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
                                        <table className="w-full text-sm">
                                            <thead className="bg-slate-50 text-xs text-slate-500 font-semibold uppercase tracking-wider">
                                                <tr>
                                                    <th className="px-4 py-3 text-left">Medicine</th>
                                                    <th className="px-4 py-3 text-left">Dosage</th>
                                                    <th className="px-4 py-3 text-left">Frequency</th>
                                                    <th className="px-4 py-3 text-left">Duration</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-50">
                                                {(p.medicines || []).map((m, i) => (
                                                    <tr key={i} className="hover:bg-slate-50/70 transition-colors">
                                                        <td className="px-4 py-3 font-semibold text-slate-800">{m.name || '—'}</td>
                                                        <td className="px-4 py-3 text-slate-600">{m.dosage || '—'}</td>
                                                        <td className="px-4 py-3 text-slate-600">{m.frequency || '—'}</td>
                                                        <td className="px-4 py-3 text-slate-600">{m.duration || '—'}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* Tests prescribed */}
                            {p.tests && (
                                <div>
                                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                        <FileText size={12} /> Tests / Investigations
                                    </h4>
                                    <p className="text-sm text-slate-700 bg-white rounded-xl border border-slate-100 p-3">{p.tests}</p>
                                </div>
                            )}

                            {/* Doctor's notes */}
                            {p.notes && (
                                <div>
                                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                        <FileText size={12} /> Doctor's Notes
                                    </h4>
                                    <p className="text-sm text-slate-700 bg-white rounded-xl border border-slate-100 p-3 whitespace-pre-line">{p.notes}</p>
                                </div>
                            )}

                            {/* Follow-up */}
                            {p.followUp && (
                                <div className="flex items-center gap-2 text-sm text-slate-600">
                                    <Calendar size={14} className="text-blue-500" />
                                    <span className="font-medium">Follow-up:</span>
                                    {new Date(p.followUp).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}
                                </div>
                            )}

                            {/* Actions */}
                            <div className="flex items-center gap-3 pt-2 border-t border-slate-100">
                                <button
                                    onClick={() => onBuy(p)}
                                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold transition-colors shadow-sm shadow-indigo-200"
                                >
                                    <ShoppingCart size={14} /> Buy Medicines
                                </button>
                                <button
                                    onClick={() => onHide(p._id)}
                                    className="flex items-center gap-1.5 px-3 py-2 text-red-500 hover:bg-red-50 rounded-xl text-sm font-medium transition-colors"
                                >
                                    <Trash2 size={14} /> Remove
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    )
}

export default function Prescriptions() {
    useProfileRender('Prescriptions', true);
    const { user } = useAuth()
    const navigate = useNavigate()
    const { hospitalSlug } = useParams()
    const queryClient = useQueryClient()

    const { data, isLoading } = useQuery({
        queryKey: ['prescriptions', user?.role],
        queryFn: user?.role === 'admin' ? listPrescriptions : getMyPrescriptions,
        enabled: !!user,
        refetchInterval: 5000,
    })

    const items = useMemo(() => Array.isArray(data) ? data : [], [data])
    const loading = isLoading

    const handleHide = async (id) => {
        if (!window.confirm('Remove this prescription from your view?')) return
        try {
            await hidePrescription(id)
            queryClient.setQueryData(['prescriptions', user?.role], prev => 
                Array.isArray(prev) ? prev.filter(x => x._id !== id) : prev
            )
            toast.success('Prescription removed')
        } catch (e) { toast.error('Failed to remove') }
    }

    const handleBuy = (p) => {
        // Navigate to medicine store pre-filtering by first medicine name
        const firstMed = (p.medicines || [])[0]?.name || ''
        const base = hospitalSlug ? `/portal/${hospitalSlug}/medicine-store` : '/medicine-store'
        const url = new URL(`${window.location.origin}${base}`)
        if (firstMed) url.searchParams.set('q', firstMed)
        url.searchParams.set('prescriptionId', p._id)
        navigate(`${url.pathname}${url.search}`)
    }

    return (
        <PageContainer>
            <PageHeader
                title={user?.role === 'admin' ? 'All Prescriptions' : 'My Prescriptions'}
                breadcrumbs={[{ label: 'Dashboard', to: '/' }, { label: 'Prescriptions' }]}
                actions={
                    <button
                        onClick={() => {
                            const base = hospitalSlug ? `/portal/${hospitalSlug}/medicine-store` : '/medicine-store'
                            navigate(base)
                        }}
                        className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors shadow-sm"
                    >
                        <ShoppingCart size={16} /> Medicine Store
                    </button>
                }
            />

            {loading ? (
                <div className="text-center text-slate-500 py-20">Loading prescriptions...</div>
            ) : items.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-16 text-center">
                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Pill size={28} className="text-slate-400" />
                    </div>
                    <p className="text-slate-700 font-medium">No prescriptions yet</p>
                    <p className="text-slate-400 text-sm mt-1">Your doctor's prescriptions will appear here after your appointment.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    <p className="text-sm text-slate-500">{items.length} prescription{items.length !== 1 ? 's' : ''} found — click to expand and see full details</p>
                    {items.map(p => (
                        <PrescriptionCard
                            key={p._id}
                            p={p}
                            onHide={handleHide}
                            onBuy={handleBuy}
                        />
                    ))}
                </div>
            )}
        </PageContainer>
    )
}

