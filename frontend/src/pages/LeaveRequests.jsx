import { useProfileRender } from '../utils/profiler';
// LeaveRequests v2 - with Approve/Reject workflow
import { useEffect, useState } from 'react';
import { listLeaves, updateLeave } from '../services/api';
import { toast } from 'react-toastify';
import { Check, X, Calendar, User, MessageSquare, Filter, Search, Clock, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import PageContainer from '../components/Admin/PageContainer'
import PageHeader from '../components/Admin/PageHeader'

export default function LeaveRequests() {
    useProfileRender('LeaveRequests', true);
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');
    const [search, setSearch] = useState('')
    const [updating, setUpdating] = useState({}) // track which requests are being updated
    const [confirmModal, setConfirmModal] = useState(null) // { id, action }

    useEffect(() => {
        fetchRequests();
    }, []);

    const fetchRequests = async () => {
        setLoading(true)
        try {
            const data = await listLeaves();
            setRequests(Array.isArray(data) ? data : []);
        } catch (error) {
            toast.error('Failed to load leave requests');
        } finally {
            setLoading(false);
        }
    };

    const handleUpdate = async (id, status) => {
        setUpdating(prev => ({ ...prev, [id]: status }))
        try {
            await updateLeave(id, { status });
            toast.success(`Leave request ${status === 'approved' ? '✅ Approved' : '❌ Rejected'} successfully`)
            setRequests(prev => prev.map(r =>
                (r._id || r.id) === id ? { ...r, status } : r
            ))
        } catch (error) {
            toast.error('Failed to update request');
        } finally {
            setUpdating(prev => { const n = { ...prev }; delete n[id]; return n })
            setConfirmModal(null)
        }
    };

    const filtered = requests.filter(r => {
        const status = (r.status || 'pending').toLowerCase()
        if (filter !== 'all' && status !== filter) return false
        if (search) {
            const name = r.staff?.name || r.doctor?.name || r.staffName || r.doctorName || ''
            return name.toLowerCase().includes(search.toLowerCase())
        }
        return true
    })

    const statusColor = (s) => {
        const st = (s || '').toLowerCase()
        if (st === 'approved') return 'bg-emerald-50 text-emerald-700 border-emerald-200'
        if (st === 'rejected') return 'bg-red-50 text-red-700 border-red-200'
        return 'bg-amber-50 text-amber-700 border-amber-200'
    }

    const isPending = (r) => {
        const s = (r.status || 'pending').toLowerCase()
        return s === 'pending'
    }

    const getPersonName = (req) =>
        req.doctor?.name || req.staff?.name || req.staffName || req.doctorName || 'Unknown'
    const getPersonRole = (req) =>
        req.doctor?.role || req.staff?.role || (req.doctor ? 'doctor' : 'staff')

    return (
        <PageContainer>
            <PageHeader
                title="Leave Requests"
                breadcrumbs={[{ label: 'Dashboard', to: '/' }, { label: 'Leaves' }]}
                actions={
                    <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-slate-200 text-sm">
                        <Filter size={14} className="text-slate-500" />
                        <select
                            className="bg-transparent outline-none font-medium text-slate-700"
                            value={filter}
                            onChange={e => setFilter(e.target.value)}
                        >
                            <option value="all">All Status</option>
                            <option value="pending">Pending</option>
                            <option value="approved">Approved</option>
                            <option value="rejected">Rejected</option>
                        </select>
                    </div>
                }
            />

            {/* Search */}
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm mb-4 p-4">
                <div className="relative max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                        className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-colors"
                        placeholder="Search by doctor / staff name..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                {loading ? (
                    <div className="p-12 text-center text-slate-500">
                        <div className="w-8 h-8 border-2 border-slate-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-3" />
                        Loading leave requests...
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="p-12 text-center text-slate-500 flex flex-col items-center">
                        <Calendar size={48} className="text-slate-200 mb-4" />
                        <p className="font-medium">No {filter !== 'all' ? filter : ''} leave requests found.</p>
                        <p className="text-sm text-slate-400 mt-1">When doctors apply for leave, they'll appear here.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-50">
                        {filtered.map(req => {
                            const id = req._id || req.id
                            const isUpdating = !!updating[id]
                            const pending = isPending(req)
                            return (
                                <motion.div
                                    initial={{ opacity: 0, y: 6 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    key={id}
                                    className={`p-5 transition-colors ${pending ? 'hover:bg-amber-50/30' : 'hover:bg-slate-50'}`}
                                >
                                    <div className="flex flex-col md:flex-row gap-4 md:items-start">
                                        {/* Avatar + Name */}
                                        <div className="flex items-center gap-3 min-w-[180px]">
                                            <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-sm shrink-0">
                                                {getPersonName(req)[0]?.toUpperCase()}
                                            </div>
                                            <div>
                                                <div className="font-semibold text-slate-800">{getPersonName(req)}</div>
                                                <div className="text-xs text-slate-500 capitalize flex items-center gap-1 mt-0.5">
                                                    <User size={11} />
                                                    {getPersonRole(req)}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Leave Info */}
                                        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3">
                                            {/* Date Range */}
                                            <div className="text-sm">
                                                <div className="flex items-center gap-2 text-slate-700 font-medium mb-1">
                                                    <Calendar size={15} className="text-indigo-400" />
                                                    <span>
                                                        {req.startDate ? new Date(req.startDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                                                        {' '}&mdash;{' '}
                                                        {req.endDate ? new Date(req.endDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                                                    </span>
                                                </div>
                                                <div className="text-xs text-slate-500 ml-6">
                                                    {req.startDate && req.endDate
                                                        ? `${Math.max(1, Math.ceil((new Date(req.endDate) - new Date(req.startDate)) / 86400000) + 1)} Days`
                                                        : ''
                                                    }
                                                    {(req.type || req.leaveType) && (
                                                        <span className="ml-1 px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 capitalize">
                                                            {req.type || req.leaveType}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Reason */}
                                            <div className="text-sm bg-slate-50 border border-slate-100 rounded-lg p-3 text-slate-600 italic flex gap-2">
                                                <MessageSquare size={14} className="text-slate-400 shrink-0 mt-0.5" />
                                                <span>{req.reason || 'No reason provided'}</span>
                                            </div>
                                        </div>

                                        {/* Status + Actions */}
                                        <div className="flex flex-col items-stretch md:items-end gap-2 min-w-[160px]">
                                            {/* Status Badge */}
                                            <div className={`px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wide border text-center ${statusColor(req.status)}`}>
                                                {(req.status || 'pending').toLowerCase()}
                                            </div>

                                            {/* Applied On */}
                                            {req.createdAt && (
                                                <div className="text-[11px] text-slate-400 flex items-center gap-1 justify-end">
                                                    <Clock size={11} />
                                                    Applied {new Date(req.createdAt).toLocaleDateString('en-IN')}
                                                </div>
                                            )}

                                            {/* Approve / Reject buttons */}
                                            {pending && (
                                                <div className="flex gap-2 mt-1">
                                                    <button
                                                        onClick={() => setConfirmModal({ id, action: 'rejected', name: getPersonName(req) })}
                                                        disabled={isUpdating}
                                                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 transition-colors text-sm font-semibold disabled:opacity-50"
                                                    >
                                                        <X size={15} />
                                                        Reject
                                                    </button>
                                                    <button
                                                        onClick={() => handleUpdate(id, 'approved')}
                                                        disabled={isUpdating}
                                                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors text-sm font-semibold shadow-sm disabled:opacity-50"
                                                    >
                                                        {isUpdating && updating[id] === 'approved' ? (
                                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                        ) : <Check size={15} />}
                                                        Approve
                                                    </button>
                                                </div>
                                            )}

                                            {/* Admin note for already-resolved */}
                                            {!pending && req.adminNote && (
                                                <div className="text-xs text-slate-500 italic max-w-[160px] text-right">
                                                    "{req.adminNote}"
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </motion.div>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* Confirm Reject Modal */}
            <AnimatePresence>
                {confirmModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm"
                        >
                            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <X size={24} className="text-red-600" />
                            </div>
                            <h3 className="font-bold text-slate-800 text-lg text-center">Reject Leave Request?</h3>
                            <p className="text-sm text-slate-500 text-center mt-2">
                                Reject the leave request from <strong>{confirmModal.name}</strong>? This action cannot be undone.
                            </p>
                            <div className="flex gap-3 mt-6">
                                <button
                                    onClick={() => setConfirmModal(null)}
                                    className="flex-1 px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => handleUpdate(confirmModal.id, 'rejected')}
                                    disabled={!!updating[confirmModal.id]}
                                    className="flex-1 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium transition-colors disabled:opacity-50"
                                >
                                    {updating[confirmModal.id] ? 'Rejecting...' : 'Yes, Reject'}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </PageContainer>
    );
}

