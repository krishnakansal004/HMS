import { useProfileRender } from '../../utils/profiler';
import React, { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { authFetch, getAuthToken, API_BASE, getPlanReceiptPdf } from '../../services/api'
import UpgradePlanModal from '../../components/UpgradePlanModal'
import RenewHistoryModal from '../../components/RenewHistoryModal'
import {
    Users, Building, DollarSign, Activity,
    CheckCircle, XCircle, Clock, Calendar,
    ExternalLink, RefreshCw, MoreHorizontal
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

function formatDate(d) {
    if (!d) return '-'
    try { return new Date(d).toLocaleString() } catch (e) { return d }
}

export default function PlansUsagePage() {
    useProfileRender('PlansUsagePage', true);
    const { token } = useAuth()
    const [tenants, setTenants] = useState([])
    const [receipts, setReceipts] = useState([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)


    useEffect(() => { if (token) load() }, [token])

    async function load() {
        setLoading(true)
        setError(null)
        try {
            const data = await authFetch(`/api/director/tenants-usage`)
            let list = data.tenants || []
            // Sort so active tenants appear first, then suspended, then cancelled
            const order = { active: 0, suspended: 1, cancelled: 2 }
            list.sort((a, b) => {
                if (!a || !b) return 0
                const oa = order[a?.status] ?? 3
                const ob = order[b?.status] ?? 3
                if (oa !== ob) return oa - ob
                // If same status, put the one with later subscriptionEnd first
                const ae = (a && a?.subscriptionEnd) ? new Date(a.subscriptionEnd).getTime() : 0
                const be = (b && b?.subscriptionEnd) ? new Date(b.subscriptionEnd).getTime() : 0
                return be - ae
            })
            setTenants(list)
            // Enrich missing payment info from plan receipts when available
            try {
                const receipts = await authFetch(`/api/plan-receipts`)
                setReceipts(receipts || [])
                // build quick lookup maps for enrichment
                const mapByEmail = new Map()
                const mapByCompany = new Map()
                    ; (receipts || []).forEach(r => {
                        try {
                            const email = (r.billing && r.billing.email) ? String(r.billing.email).toLowerCase() : null
                            const company = (r.billing && r.billing.company) ? String(r.billing.company).toLowerCase() : null
                            if (email && !mapByEmail.has(email)) mapByEmail.set(email, r)
                            if (company && !mapByCompany.has(company)) mapByCompany.set(company, r)
                        } catch (e) { }
                    })
                const enriched = list.map(t => {
                    try {
                        const pi = t?.paymentInfo || {}
                        if (!pi.amountCents || !pi.lastPaymentAt) {
                            const dirEmail = t?.director?.email ? String(t.director.email).toLowerCase() : null
                            const byEmail = dirEmail ? mapByEmail.get(dirEmail) : null
                            const byCompany = mapByCompany.get(String((t?.name || '').toLowerCase()))
                            const r = byEmail || byCompany || null
                            if (r) {
                                const updated = { ...t }
                                updated.paymentInfo = { ...(updated.paymentInfo || {}) }
                                if (!updated.paymentInfo.amountCents && typeof r.total !== 'undefined') {
                                    const n = Number(r.total) || 0
                                    updated.paymentInfo.amountCents = Math.round(n)
                                }
                                if (!updated.paymentInfo.lastPaymentAt && r.paidAt) updated.paymentInfo.lastPaymentAt = r.paidAt
                                if (!updated.paymentInfo.transactionId && r.invoiceNumber) updated.paymentInfo.transactionId = r.invoiceNumber
                                return updated
                            }
                        }
                        return t
                    } catch (e) { 
                        return t
                    }
                })
                setTenants(enriched.filter(Boolean))
            } catch (e) {
                console.warn('Failed to enrich tenants with plan receipts', e)
            }
        } catch (e) {
            console.error(e)
            setError(e.message || 'Error')
        } finally { setLoading(false) }
    }

    const [showUpgradeModal, setShowUpgradeModal] = useState(false)
    const [upgradeTenant, setUpgradeTenant] = useState(null)
    const [plansList, setPlansList] = useState([])
    const [historyOpen, setHistoryOpen] = useState(false)
    const [selectedTenant, setSelectedTenant] = useState(null)

    async function handleUpgrade(t) {
        try {
            if (!token) { alert('Not authenticated — please login as director'); return }
            // fetch plans and open modal
            const plans = await authFetch(`/api/plans`)
            if (!Array.isArray(plans) || plans.length === 0) return alert('No plans available')
            setPlansList(plans)
            setUpgradeTenant(t)
            setShowUpgradeModal(true)
        } catch (e) {
            console.error(e)
            alert('Upgrade error: ' + (e && e.message))
        }
    }

    function onUpgradeModalClose(done) {
        setShowUpgradeModal(false)
        setUpgradeTenant(null)
        setPlansList([])
        if (done) load()
    }

    const statsCards = [
        { label: 'Total Tenants', value: tenants.length, icon: Building, color: '#6366f1' },
        { label: 'Active', value: tenants.filter(t => t?.status === 'active').length, icon: CheckCircle, color: '#10b981' },
        {
            label: 'Expiring Soon', value: (tenants || []).filter(t => {
                if (!t || !t?.subscriptionEnd) return false
                try {
                    const end = new Date(t.subscriptionEnd)
                    const soon = new Date(); soon.setDate(soon.getDate() + 14)
                    return end > new Date() && end <= soon
                } catch (e) { return false }
            }).length, icon: Clock, color: '#f59e0b'
        },
        { label: 'Est. Revenue', value: `₹${(tenants.reduce((acc, t) => acc + (t.paymentInfo?.amountCents || 0), 0) / 100).toLocaleString()}`, icon: DollarSign, color: '#ec4899' }
    ]

    return (
        <div className="p-4 md:p-8 space-y-8 pb-12">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Plans & Subscriptions</h1>
                    <p className="text-slate-500 mt-1">Manage tenant lifecycles and subscription integrity.</p>
                </div>
                <button
                    onClick={load}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600 font-medium transition-colors shadow-sm self-start md:self-center"
                >
                    <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                    <span>Refresh</span>
                </button>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {statsCards.map((card, i) => (
                    <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex items-center gap-4 group hover:shadow-md transition-all"
                    >
                        <div className="p-3 rounded-xl transition-all" style={{ backgroundColor: `${card.color}15`, color: card.color }}>
                            <card.icon size={24} />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{card.label}</p>
                            <h3 className="text-2xl font-bold text-slate-800">{card.value}</h3>
                        </div>
                    </motion.div>
                ))}
            </div>

            {error && <div className="p-4 bg-red-50 text-red-600 rounded-xl border border-red-100 mb-4">{error}</div>}

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="table-responsive overflow-x-auto" style={{ maxHeight: '70vh' }}>
                    <table className="w-full text-left border-collapse min-w-[1400px]">
                        <thead>
                            <tr className="bg-slate-50/50 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                <th className="px-6 py-4">Tenant / ID</th>
                                <th className="px-6 py-4">Owner Contact</th>
                                <th className="px-6 py-4">Subscription Plan</th>
                                <th className="px-6 py-4">Timeline</th>
                                <th className="px-6 py-4">Last Payment</th>
                                <th className="px-6 py-4">Renewals</th>
                                <th className="px-6 py-4">Usage</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {loading && (
                                <tr>
                                    <td colSpan={9} className="p-12 text-center text-slate-400">
                                        <div className="flex flex-col items-center gap-2">
                                            <RefreshCw className="animate-spin" size={24} />
                                            <span>Syncing platform data...</span>
                                        </div>
                                    </td>
                                </tr>
                            )}
                            {!loading && tenants.length === 0 && <tr><td colSpan={9} className="p-12 text-center text-slate-400">No tenants found in system</td></tr>}
                            {tenants.map((t, idx) => (
                                <motion.tr
                                    key={t.id}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: idx * 0.05 }}
                                    className="hover:bg-slate-50/50 transition-colors group"
                                >
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col">
                                            <span className="font-bold text-slate-800">{t.name}</span>
                                            <code className="text-[10px] text-slate-400 select-all">{(t.id || t._id).slice(-12)}</code>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        {t.director ? (
                                            <div className="flex flex-col text-sm">
                                                <span className="font-medium text-slate-700">{t.director.name}</span>
                                                <span className="text-xs text-slate-400">{t.director.email}</span>
                                            </div>
                                        ) : <span className="text-slate-300">-</span>}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="inline-flex px-2 py-1 rounded bg-indigo-50 text-indigo-700 text-xs font-bold border border-indigo-100">
                                            {t.plan?.name || t.plan?._id || 'Standard Plan'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col gap-1 text-[11px]">
                                            <div className="flex items-center gap-1.5 text-slate-500">
                                                <Calendar size={12} className="text-slate-300" />
                                                <span>Start: {formatDate(t.subscriptionStart)}</span>
                                            </div>
                                            <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                                                <Clock size={12} className="text-slate-300" />
                                                <span>End: {formatDate(t.subscriptionEnd)}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col gap-1">
                                            <span className="text-sm font-bold text-slate-700">
                                                {t.paymentInfo?.amountCents ? `₹${(t.paymentInfo.amountCents / 100).toLocaleString()}` : 'Free'}
                                            </span>
                                            <span className="text-[10px] text-slate-400 flex items-center gap-1 uppercase">
                                                {t.paymentInfo?.provider || 'None'}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        {(() => {
                                            try {
                                                const matches = (receipts || []).filter(r => {
                                                    try {
                                                        const company = r.billing && r.billing.company ? String(r.billing.company).toLowerCase() : null
                                                        const email = r.billing && r.billing.email ? String(r.billing.email).toLowerCase() : null
                                                        const dirEmail = t.director && t.director.email ? String(t.director.email).toLowerCase() : null
                                                        if (company && company === String((t.name || '').toLowerCase())) return true
                                                        if (email && dirEmail && email === dirEmail) return true
                                                    } catch (e) { }
                                                    return false
                                                })
                                                if (!matches || matches.length === 0) return <span className="text-sm text-slate-300">-</span>
                                                matches.sort((a, b) => new Date(b.paidAt || b.createdAt).getTime() - new Date(a.paidAt || a.createdAt).getTime())
                                                const latest = matches[0]
                                                return (
                                                    <div className="text-xs">
                                                        <div className="font-medium text-slate-600">{formatDate(latest.paidAt || latest.createdAt)}</div>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <button onClick={() => { setSelectedTenant(t); setHistoryOpen(true) }} className="text-indigo-600 hover:underline">History</button>
                                                            <button 
                                                                onClick={async (e) => {
                                                                    e.preventDefault();
                                                                    try {
                                                                        const blob = await getPlanReceiptPdf(latest._id);
                                                                        const url = window.URL.createObjectURL(blob);
                                                                        const a = document.createElement('a');
                                                                        a.href = url;
                                                                        a.download = `receipt-${latest.invoiceNumber || latest._id}.pdf`;
                                                                        document.body.appendChild(a);
                                                                        a.click();
                                                                        a.remove();
                                                                        window.URL.revokeObjectURL(url);
                                                                    } catch (err) {
                                                                        console.error(err);
                                                                        alert('Download failed');
                                                                    }
                                                                }}
                                                                className="text-slate-400 hover:text-slate-950 transition-colors"
                                                            >
                                                                <ExternalLink size={12} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                )
                                            } catch (e) { return <span className="text-slate-300">-</span> }
                                        })()}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-wrap gap-1.5 max-w-[150px]">
                                            <span className="px-1.5 py-0.5 bg-slate-100 text-[10px] font-bold text-slate-600 rounded">Adm: {t.usage?.admins || 0}</span>
                                            <span className="px-1.5 py-0.5 bg-slate-100 text-[10px] font-bold text-slate-600 rounded">Doc: {t.usage?.doctors || 0}</span>
                                            <span className="px-1.5 py-0.5 bg-slate-100 text-[10px] font-bold text-slate-600 rounded">Pat: {t.usage?.patients || 0}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        {t?.status === 'active' ? (
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600 text-xs font-bold border border-emerald-100">
                                                <CheckCircle size={12} /> Active
                                            </span>
                                        ) : t?.status === 'suspended' ? (
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 text-amber-600 text-xs font-bold border border-amber-100">
                                                <Clock size={12} /> Suspended
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-50 text-rose-600 text-xs font-bold border border-rose-100">
                                                <XCircle size={12} /> Cancelled
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button
                                            onClick={() => handleUpgrade(t)}
                                            className="p-2 hover:bg-indigo-50 text-indigo-600 rounded-lg transition-colors tooltip-trigger"
                                            title="Upgrade Plan"
                                        >
                                            <RefreshCw size={18} />
                                        </button>
                                    </td>
                                </motion.tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {showUpgradeModal && upgradeTenant && (
                <UpgradePlanModal open={showUpgradeModal} onClose={onUpgradeModalClose} tenant={upgradeTenant} plans={plansList} apiBase={API_BASE} />
            )}
            {historyOpen && selectedTenant && (
                <RenewHistoryModal open={historyOpen} onClose={() => { setHistoryOpen(false); setSelectedTenant(null) }} tenant={selectedTenant} receipts={receipts} apiBase={API_BASE} token={token} />
            )}
        </div>
    )
}


