import { useProfileRender } from '../../utils/profiler';
import React, { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { authFetch, API_BASE } from '../../services/api'
import { FileText, CheckCircle, XCircle, Clock, Trash2, RefreshCw, Layers, ShieldCheck, RefreshCcw } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'react-toastify'

function formatDate(d) {
    if (!d) return '-'
    try { return new Date(d).toLocaleString() } catch (e) { return d }
}

export default function QueryForPlans() {
    useProfileRender('QueryForPlans', true);
    const { token } = useAuth()

    const [requests, setRequests] = useState([])
    const [loadingRequests, setLoadingRequests] = useState(false)
    const [errorRequests, setErrorRequests] = useState(null)
    const [plansMap, setPlansMap] = useState({})
    const [plansList, setPlansList] = useState([])

    useEffect(() => { if (token) loadRequests() }, [token])
    useEffect(() => { if (token) loadPlans() }, [token])


    async function loadRequests() {
        setLoadingRequests(true)
        setErrorRequests(null)
        try {
            const data = await authFetch(`/api/plan-requests`)
            setRequests(data.requests || [])
        } catch (e) {
            console.error(e)
            setErrorRequests(e.message || 'Error')
        } finally { setLoadingRequests(false) }
    }

    async function syncPayment(paymentLinkId) {
        if (!paymentLinkId) {
            toast.warn('No payment link associated with this request.');
            return;
        }
        try {
            const res = await fetch(`${API_BASE}/api/payments/razorpay/check-public/${paymentLinkId}`);
            const data = await res.json();
            if (data.paid) {
                toast.success('Payment confirmed! Record updated.');
                await loadRequests();
            } else {
                toast.info(`Payment status: ${data.status || 'not paid'}`);
            }
        } catch (e) {
            console.error(e);
            toast.error('Failed to sync payment status');
        }
    }

    async function loadPlans() {
        try {
            const data = await authFetch(`/api/plans`)
            const map = {}
            const list = (data.plans || data || [])
            list.forEach(p => {
                if (!p || !p.name) return
                const key = (p.name || '').trim().toLowerCase()
                map[key] = p
            })
            setPlansMap(map)
            setPlansList(list)
        } catch (e) {
            console.error('Failed to load plans', e)
        }
    }

    function computeAmountForRequest(r) {
        if (!r || !r.planName) return '-'
        let plan = plansMap[(r.planName || '').toLowerCase()]
        if (!plan || !plan.prices) {
            // try fuzzy match: find a plan whose name includes the request planName or vice versa
            const wanted = (r.planName || '').trim().toLowerCase()
            const fuzzy = plansList.find(p => {
                if (!p || !p.name) return false
                const n = (p.name || '').trim().toLowerCase()
                return n === wanted || n.includes(wanted) || wanted.includes(n)
            })
            if (fuzzy && fuzzy.prices) plan = fuzzy
        }
        if (!plan || !plan.prices) return '-'
        const prices = plan.prices || {}
        let cents = 0
        switch ((r.period || '').toLowerCase()) {
            case 'monthly': cents = prices.month || 0; break
            case '3months': cents = prices.threeMonths || 0; break
            case 'yearly': cents = prices.year || 0; break
            case '5years': cents = prices.fiveYears || 0; break
            default: cents = prices.month || 0; break
        }
        if (!cents) return '₹0.00'
        try {
            const rupees = (cents / 100).toFixed(2)
            return `₹${rupees}`
        } catch (e) { return `₹${cents}` }
    }

    const requestStats = [
        { label: 'Total Requests', value: requests.length, icon: Layers, color: '#6366f1' },
        { label: 'New', value: requests.filter(r => r.status === 'new').length, icon: Clock, color: '#f59e0b' },
        { label: 'Approved', value: requests.filter(r => r.status === 'processed').length, icon: CheckCircle, color: '#10b981' },
        { label: 'Rejected', value: requests.filter(r => r.status === 'rejected').length, icon: XCircle, color: '#ef4444' }
    ]

    return (
        <div className="p-4 md:p-8 space-y-8 pb-12">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Plan Requests Explorer</h1>
                    <p className="text-slate-500 mt-1">Audit and process custom subscription inquiries.</p>
                </div>
                <button
                    onClick={loadRequests}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600 font-medium transition-colors shadow-sm self-start md:self-center"
                >
                    <RefreshCw size={18} className={loadingRequests ? 'animate-spin' : ''} />
                    <span>Sync Requests</span>
                </button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {requestStats.map((card, i) => (
                    <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex items-center gap-4 hover:shadow-md transition-all"
                    >
                        <div className="p-3 rounded-xl" style={{ backgroundColor: `${card.color}15`, color: card.color }}>
                            <card.icon size={24} />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{card.label}</p>
                            <h3 className="text-2xl font-bold text-slate-800">{card.value}</h3>
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Requests Table */}
            <div className="space-y-4">
                <div className="flex items-center gap-2">
                    <FileText className="text-indigo-600" size={20} />
                    <h2 className="text-lg font-bold text-slate-800">Submitted Plan Requests</h2>
                </div>

                {errorRequests && <div className="p-4 bg-red-50 text-red-600 rounded-xl border border-red-100">{errorRequests}</div>}

                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="table-responsive overflow-x-auto" style={{ maxHeight: '60vh' }}>
                        <table className="w-full text-left border-collapse min-w-[1400px]">
                            <thead>
                                <tr className="bg-slate-50/50 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                    <th className="px-6 py-4">Submission</th>
                                    <th className="px-6 py-4">Requested Plan</th>
                                    <th className="px-6 py-4">Lead Contact</th>
                                    <th className="px-6 py-4">Financials</th>
                                    <th className="px-6 py-4">Status</th>
                                    <th className="px-6 py-4">Verification</th>
                                    <th className="px-6 py-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {loadingRequests && (
                                    <tr>
                                        <td colSpan={7} className="p-12 text-center text-slate-400">
                                            <div className="flex flex-col items-center gap-2">
                                                <RefreshCw className="animate-spin" size={24} />
                                                <span>Fetching incoming leads...</span>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                                {!loadingRequests && requests.length === 0 && <tr><td colSpan={7} className="p-12 text-center text-slate-400">No pending plan requests found</td></tr>}
                                {requests.map((r, idx) => (
                                    <motion.tr
                                        key={r._id}
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        transition={{ delay: idx * 0.05 }}
                                        className="hover:bg-slate-50/50 transition-colors group"
                                    >
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-medium text-slate-700">{formatDate(r.createdAt)}</span>
                                                <span className="text-[10px] text-slate-400 uppercase font-bold">Ref: {r._id.slice(-8)}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-slate-800">{r.planName}</span>
                                                <span className="text-xs text-indigo-600 font-medium">{r.period} cycle</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-slate-800">{r.customerName}</span>
                                                <div className="flex flex-col text-[11px] text-slate-500 mt-0.5">
                                                    <span>{r.customerEmail}</span>
                                                    <span>{r.customerCountryCode} {r.customerPhone}</span>
                                                    {r.company && <span className="text-indigo-500 font-medium mt-0.5">{r.company}</span>}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-bold text-slate-700">
                                                    {typeof r.computedAmount === 'number' && r.computedAmount >= 0 ? `₹${(r.computedAmount || 0).toFixed(2)}` : computeAmountForRequest(r)}
                                                </span>
                                                <span className="text-[10px] text-slate-400 uppercase">Estimated Total</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            {r.status === 'paid' ? (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 text-blue-600 text-xs font-bold border border-blue-100">
                                                    <CheckCircle size={12} /> Paid
                                                </span>
                                            ) : r.status === 'processed' ? (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600 text-xs font-bold border border-emerald-100">
                                                    <CheckCircle size={12} /> Approved
                                                </span>
                                            ) : r.status === 'rejected' ? (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-50 text-rose-600 text-xs font-bold border border-rose-100">
                                                    <XCircle size={12} /> Rejected
                                                </span>
                                            ) : (
                                                <span className="text-[10px] text-slate-300 font-bold uppercase tracking-tight italic">Pending Decision</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col gap-1.5 max-w-[200px]">
                                                {r.idDocument ? (
                                                    <a className="inline-flex items-center gap-1.5 text-indigo-600 font-bold text-xs hover:underline" href={r.idDocument.path} target="_blank" rel="noreferrer">
                                                        <FileText size={14} /> View Document
                                                    </a>
                                                ) : <span className="text-[10px] text-slate-300">No identity proof</span>}
                                                <p className="text-[10px] text-slate-400 italic line-clamp-2" title={r.description}>{r.description || 'No additional notes'}</p>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex gap-2 justify-end">
                                                {(!r.status || r.status === 'new') && (
                                                    <>
                                                        <button
                                                            onClick={async () => {
                                                                if (!confirm('Confirm and send payment link?')) return;
                                                                try {
                                                                    const data = await authFetch(`/api/plan-requests/${r._id}/status`, { 
                                                                        method: 'PUT', 
                                                                        headers: { 'Content-Type': 'application/json' }, 
                                                                        body: JSON.stringify({ status: 'processed' }) 
                                                                    });
                                                                    
                                                                    if (data && data.responsePaymentShortUrl) {
                                                                        window.open(data.responsePaymentShortUrl, '_blank');
                                                                        toast.success('Approved! Payment link opened.');
                                                                    } else {
                                                                        toast.info('Approved. Plan activated (no payment link required).');
                                                                    }
                                                                    await loadRequests();
                                                                } catch (e) {
                                                                    toast.error(e.message || 'Approval failed');
                                                                }
                                                            }}
                                                            className="p-2 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-600 hover:text-white transition-all shadow-sm flex items-center gap-1"
                                                            title="Approve & Send Invoice"
                                                        >
                                                            <CheckCircle size={18} />
                                                            <span className="text-[10px] font-bold pr-1">APPROVE</span>
                                                        </button>
                                                        <button
                                                            onClick={async () => {
                                                                if (!confirm('Reject this lead?')) return;
                                                                try {
                                                                    await authFetch(`/api/plan-requests/${r._id}/status`, { 
                                                                        method: 'PUT', 
                                                                        headers: { 'Content-Type': 'application/json' }, 
                                                                        body: JSON.stringify({ status: 'rejected' }) 
                                                                    });
                                                                    toast.success('Request rejected');
                                                                    await loadRequests();
                                                                } catch (e) { 
                                                                    toast.error(e.message || 'Rejection failed');
                                                                }
                                                            }}
                                                            className="p-2 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-600 hover:text-white transition-all shadow-sm flex items-center gap-1"
                                                            title="Reject"
                                                        >
                                                            <XCircle size={18} />
                                                            <span className="text-[10px] font-bold pr-1">REJECT</span>
                                                        </button>
                                                    </>
                                                )}
                                                {r.status === 'processed' && r.paymentLinkId && (
                                                    <button
                                                        onClick={() => syncPayment(r.paymentLinkId)}
                                                        className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-600 hover:text-white transition-all shadow-sm flex items-center gap-1"
                                                        title="Sync Payment Status"
                                                    >
                                                        <RefreshCcw size={18} />
                                                        <span className="text-[10px] font-bold pr-1">SYNC PAY</span>
                                                    </button>
                                                )}
                                                <button
                                                    onClick={async () => {
                                                        if (!confirm('Permanently delete this request?')) return;
                                                        try {
                                                            const res = await authFetch(`/api/plan-requests/${r._id}`, { method: 'DELETE' })
                                                            if (!res.ok && res.status !== 404) throw new Error('Failed to delete')
                                                            await loadRequests()
                                                        } catch (e) { alert('Delete failed') }
                                                    }}
                                                    className="p-2 bg-slate-50 text-slate-400 rounded-lg hover:bg-slate-200 hover:text-slate-600 transition-all shadow-sm"
                                                    title="Delete"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </td>
                                    </motion.tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    )
}
