import { useProfileRender } from '../../utils/profiler';
import React, { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { authFetch } from '../../services/api'
import { MessageSquare, Clock, CheckCircle, XCircle, Search, Filter, Mail, Phone, Building, FileText, ChevronRight, User } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export default function CustomizationRequests() {
    useProfileRender('CustomizationRequests', true);
    const { token } = useAuth()
    const [requests, setRequests] = useState([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)
    const [filter, setFilter] = useState('all')
    const [searchEmail, setSearchEmail] = useState('')
    const [view, setView] = useState('requests') // 'requests' or 'history'
    const [showNoteModal, setShowNoteModal] = useState(false)
    const [noteText, setNoteText] = useState('')
    const [activeId, setActiveId] = useState(null)
    const [expandedId, setExpandedId] = useState(null)

    useEffect(() => {
        if (token) loadRequests()
    }, [token])

    async function loadRequests() {
        setLoading(true)
        setError(null)
        try {
            const data = await authFetch(`/api/customization-requests`)
            setRequests(data.requests || [])
        } catch (e) { setError(e.message) }
        finally { setLoading(false) }
    }

    async function updateStatus(id, status, note) {
        try {
            await authFetch(`/api/customization-requests/${id}/status`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status, note }) })
            await loadRequests()
        } catch (e) { alert('Failed to update status') }
    }

    const filteredRequests = requests.filter(r => {
        if (filter && filter !== 'all' && r.status !== filter) return false
        if (searchEmail && !(r.requesterEmail || '').toLowerCase().includes(searchEmail.toLowerCase())) return false
        if (view === 'requests') return r.status !== 'completed' && r.status !== 'rejected'
        if (view === 'history') return r.status === 'completed' || r.status === 'rejected'
        return true
    })

    return (
        <div className="p-8 space-y-6">
            <div className="flex flex-col sm:flex-row justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Customization Requests</h1>
                    <p className="text-slate-500">Review and manage tenant customization needs.</p>
                </div>
                <div className="flex bg-slate-100 p-1 rounded-xl w-fit h-fit">
                    <button onClick={() => setView('requests')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${view === 'requests' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Active Requests</button>
                    <button onClick={() => setView('history')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${view === 'history' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>History</button>
                </div>
            </div>

            <div className="flex flex-col md:flex-row gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input value={searchEmail} onChange={e => setSearchEmail(e.target.value)} placeholder="Search requester email..." className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500/20 text-sm" />
                </div>
                <div className="relative w-full md:w-48">
                    <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <select value={filter} onChange={e => setFilter(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500/20 text-sm appearance-none cursor-pointer">
                        <option value="all">All Statuses</option>
                        <option value="new">New</option>
                        <option value="in_progress">In Progress</option>
                        {view === 'history' && <option value="completed">Completed</option>}
                        {view === 'history' && <option value="rejected">Rejected</option>}
                    </select>
                </div>
            </div>

            <div className="space-y-4">
                <AnimatePresence>
                    {filteredRequests.map((r, i) => (
                        <motion.div
                            key={r._id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.05 }}
                            className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
                        >
                            <div className="p-6 cursor-pointer hover:bg-slate-50/50 transition-colors" onClick={() => setExpandedId(expandedId === r._id ? null : r._id)}>
                                <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${r.status === 'new' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                                                r.status === 'in_progress' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                                                    r.status === 'completed' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                                        'bg-slate-100 text-slate-600 border-slate-200'
                                                }`}>
                                                {String(r.status || 'unknown').replace('_', ' ')}
                                            </span>
                                            <span className="text-xs text-slate-400 flex items-center gap-1"><Clock size={12} /> {new Date(r.createdAt).toLocaleDateString()}</span>
                                        </div>
                                        <h3 className="text-lg font-bold text-slate-800 mb-1">{r.title}</h3>
                                        <p className="text-sm text-slate-500 line-clamp-1">{r.description}</p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        {view === 'requests' && (
                                            <>
                                                {r.status === 'new' && (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); if (confirm('Mark in progress?')) updateStatus(r._id, 'in_progress') }}
                                                        className="px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-sm font-medium hover:bg-indigo-100 transition-colors"
                                                    >
                                                        Review
                                                    </button>
                                                )}
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); setActiveId(r._id); setNoteText(''); setShowNoteModal(true); }}
                                                    className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 shadow-sm transition-colors"
                                                >
                                                    Complete
                                                </button>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); if (confirm('Reject?')) updateStatus(r._id, 'rejected') }}
                                                    className="px-3 py-1.5 bg-white border border-slate-200 text-slate-600 rounded-lg text-sm font-medium hover:bg-red-50 hover:text-red-600 hover:border-red-100 transition-colors"
                                                >
                                                    Reject
                                                </button>
                                            </>
                                        )}
                                        <ChevronRight size={20} className={`text-slate-400 transition-transform ${expandedId === r._id ? 'rotate-90' : ''}`} />
                                    </div>
                                </div>
                            </div>

                            <AnimatePresence>
                                {expandedId === r._id && (
                                    <motion.div
                                        initial={{ height: 0 }}
                                        animate={{ height: 'auto' }}
                                        exit={{ height: 0 }}
                                        className="overflow-hidden border-t border-slate-100 bg-slate-50/30"
                                    >
                                        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8 text-sm">
                                            <div className="space-y-4">
                                                <h4 className="font-semibold text-slate-800 flex items-center gap-2"><User size={16} /> Requester Info</h4>
                                                <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-2">
                                                    <div className="flex justify-between border-b border-slate-50 pb-2">
                                                        <span className="text-slate-500">Name</span>
                                                        <span className="font-medium text-slate-700">{r.requesterName}</span>
                                                    </div>
                                                    <div className="flex justify-between border-b border-slate-50 pb-2">
                                                        <span className="text-slate-500 flex items-center gap-1"><Mail size={12} /> Email</span>
                                                        <span className="font-medium text-slate-700">{r.requesterEmail}</span>
                                                    </div>
                                                    <div className="flex justify-between border-b border-slate-50 pb-2">
                                                        <span className="text-slate-500 flex items-center gap-1"><Phone size={12} /> Phone</span>
                                                        <span className="font-medium text-slate-700">{r.requesterPhone || '-'}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-slate-500 flex items-center gap-1"><Building size={12} /> Company</span>
                                                        <span className="font-medium text-slate-700">{r.company || '-'}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="space-y-4">
                                                <h4 className="font-semibold text-slate-800 flex items-center gap-2"><FileText size={16} /> Request Details</h4>
                                                <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
                                                    <div>
                                                        <span className="text-xs font-semibold text-slate-400 uppercase">Purpose</span>
                                                        <p className="text-slate-700 mt-0.5">{r.purpose}</p>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div>
                                                            <span className="text-xs font-semibold text-slate-400 uppercase">Budget</span>
                                                            <p className="text-slate-700 mt-0.5">{r.priceRange || 'N/A'}</p>
                                                        </div>
                                                        <div>
                                                            <span className="text-xs font-semibold text-slate-400 uppercase">Timeline</span>
                                                            <p className="text-slate-700 mt-0.5">{r.period || 'N/A'}</p>
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <span className="text-xs font-semibold text-slate-400 uppercase">Description</span>
                                                        <p className="text-slate-700 mt-1 whitespace-pre-wrap leading-relaxed">{r.description}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>
                    ))}
                    {!loading && filteredRequests.length === 0 && (
                        <div className="text-center py-12 bg-white rounded-2xl border border-slate-200 border-dashed">
                            <div className="inline-flex p-4 bg-slate-50 rounded-full mb-3"><MessageSquare size={24} className="text-slate-300" /></div>
                            <p className="text-slate-500">No requests found matching your filters.</p>
                        </div>
                    )}
                </AnimatePresence>
            </div>

            {/* Completion Modal */}
            <AnimatePresence>
                {showNoteModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowNoteModal(false)} />
                        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg p-6">
                            <h3 className="text-lg font-bold text-slate-800 mb-2">Complete Request</h3>
                            <p className="text-sm text-slate-500 mb-4">Add a closing note (optional). This will be sent to the requester.</p>
                            <textarea
                                value={noteText}
                                onChange={e => setNoteText(e.target.value)}
                                className="w-full border border-slate-200 rounded-xl p-3 h-32 mb-4 focus:ring-2 focus:ring-emerald-500/20 outline-none text-sm resize-none"
                                placeholder="Type your message here..."
                            />
                            <div className="flex justify-end gap-2">
                                <button onClick={() => setShowNoteModal(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-50 rounded-xl font-medium transition-colors">Cancel</button>
                                <button onClick={() => { if (activeId) { updateStatus(activeId, 'completed', noteText); setShowNoteModal(false); } }} className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition-colors shadow-sm">Complete Request</button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    )
}
