import { useProfileRender } from '../utils/profiler';
import { useEffect, useState, useMemo } from 'react'
import { useLocation, useNavigate, Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { listPurchases, getMyTenant } from '../services/api'
import { toast } from 'react-toastify'
import PurchaseModal from '../components/PurchaseModal'
import PageContainer from '../components/Admin/PageContainer'
import PageHeader from '../components/Admin/PageHeader'
import { AnimatePresence } from 'framer-motion'
import { Plus } from 'lucide-react'

const StatusBadge = ({ status }) => {
    const colors = {
        Pending: 'bg-amber-50 text-amber-700 border-amber-100',
        Completed: 'bg-emerald-50 text-emerald-700 border-emerald-100',
        Cancelled: 'bg-red-50 text-red-700 border-red-100',
    }
    return (
        <span className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${colors[status] || 'bg-slate-50 text-slate-600 border-slate-100'}`}>
            {status}
        </span>
    )
}

export default function Purchases() {
    useProfileRender('Purchases', true);
    const location = useLocation()
    const navigate = useNavigate()
    const queryClient = useQueryClient()
    const [showForm, setShowForm] = useState(false)

    // Load Tenant details using TanStack Query
    const { data: tenantData } = useQuery({
        queryKey: ['tenant'],
        queryFn: getMyTenant
    })
    const tenant = tenantData?.tenant || null
    const canCreatePurchase = useMemo(() => {
        if (!tenant) return true
        if (tenant.plan?.limits?.purchases == null) return true
        const usage = tenant.usage || {}
        return (usage.purchases || 0) < tenant.plan.limits.purchases
    }, [tenant])

    // Load Purchases list using TanStack Query
    const { data: rawPurchases, isLoading: loading } = useQuery({
        queryKey: ['purchases'],
        queryFn: listPurchases
    })
    const data = useMemo(() => Array.isArray(rawPurchases) ? rawPurchases : [], [rawPurchases])

    // Auto-open modal when navigated with ?new=1
    useEffect(() => {
        const params = new URLSearchParams(location.search)
        if (params.get('new') === '1') setShowForm(true)
    }, [location.search])

    return (
        <PageContainer>
            <PageHeader
                title="Purchase Orders"
                breadcrumbs={[{ label: 'Dashboard', to: '/' }, { label: 'Purchases' }]}
                actions={
                    <button
                        className={`flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl font-medium shadow-sm hover:bg-blue-700 transition-all ${!canCreatePurchase ? 'opacity-60 cursor-not-allowed' : ''}`}
                        onClick={() => {
                            if (!canCreatePurchase) {
                                try {
                                    const now = new Date()
                                    if (tenant && tenant.subscriptionEnd && now >= new Date(tenant.subscriptionEnd)) {
                                        navigate('/director/queryforplan')
                                        return
                                    }
                                } catch (e) { }
                                toast.info('Purchase limit reached. Upgrade plan to add more.')
                                return
                            }
                            setShowForm(true)
                        }}
                        disabled={!canCreatePurchase}
                    >
                        <Plus size={18} />
                        New Purchase
                    </button>
                }
            />

            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-50 sticky top-0 z-10">
                            <tr>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Order ID</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Supplier</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Items</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Date</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Total Amount</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {loading ? (
                                <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-500">Loading purchases...</td></tr>
                            ) : data.length === 0 ? (
                                <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-500">No purchase records found.</td></tr>
                            ) : data.map((p) => (
                                <tr key={p._id} className="hover:bg-slate-50/80 transition-colors group">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center">
                                                <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                                            </div>
                                            <span className="text-sm font-bold text-slate-700">#{p.orderId || p._id?.slice(-6) || '—'}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-slate-600 font-medium">{(p.supplier?.name || (typeof p.supplier === 'string' ? p.supplier : '—'))}</td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-wrap gap-1 max-w-xs">
                                            {p.items?.map((it, idx) => (
                                                <span key={idx} className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                                                    {(it.medicine?.name || (typeof it.medicine === 'string' ? it.medicine : 'Medicine'))} x{it.quantity}
                                                </span>
                                            ))}
                                            {(!p.items || p.items.length === 0) && <span className="text-slate-400 text-xs">—</span>}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-slate-600">
                                        {p.createdAt ? new Date(p.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A'}
                                    </td>
                                    <td className="px-6 py-4">
                                        <StatusBadge status={p.status} />
                                    </td>
                                    <td className="px-6 py-4 text-right font-bold text-slate-800">
                                        ₹{Number(p.totalCost || 0).toFixed(2)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <AnimatePresence>
                {showForm && canCreatePurchase && (
                    <PurchaseModal
                        onClose={() => setShowForm(false)}
                        onSaved={() => {
                            setShowForm(false)
                            queryClient.invalidateQueries({ queryKey: ['purchases'] })
                            queryClient.invalidateQueries({ queryKey: ['tenant'] })
                        }}
                    />
                )}
            </AnimatePresence>

            {showForm && !canCreatePurchase && tenant && tenant.subscriptionEnd && (new Date() >= new Date(tenant.subscriptionEnd)) && (
                <div className="fixed inset-0 bg-black/40 grid place-items-center p-4 z-50">
                    <div className="bg-white rounded-xl p-6 max-w-lg w-full shadow-2xl">
                        <h3 className="font-bold text-lg mb-2">Limit reached</h3>
                        <p className="text-slate-600 mb-6">Your current plan does not allow creating more purchases. Please upgrade your plan.</p>
                        <div className="flex justify-end gap-3">
                            <button className="px-4 py-2 border rounded-lg hover:bg-slate-50 transition-colors" onClick={() => setShowForm(false)}>Close</button>
                            <Link to="/director/queryforplan" onClick={() => setShowForm(false)} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">Upgrade Plan</Link>
                        </div>
                    </div>
                </div>
            )}
        </PageContainer>
    )
}
