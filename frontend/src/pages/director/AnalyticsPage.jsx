import { useProfileRender } from '../../utils/profiler';
import React, { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { listPlanReceipts, listPurchases, authFetch } from '../../services/api'
import { BarChart, DollarSign, TrendingUp, CreditCard, Calendar, ArrowRight } from 'lucide-react'
import { motion } from 'framer-motion'
// Note: Ideally moving forward we'd import the actual Chart.js components if we want real graphs, 
// but for now we'll style the metrics beautifully.

function isoLocal(d) {
    if (!d) return ''
    const dt = new Date(d)
    const tzOffset = dt.getTimezoneOffset() * 60000
    return new Date(dt - tzOffset).toISOString().slice(0, 10)
}

const endpoint = '/api/director/earnings'

export default function AnalyticsPage() {
    useProfileRender('AnalyticsPage', true);
    const { token, user } = useAuth()
    const [period, setPeriod] = useState('day')
    const [start, setStart] = useState(isoLocal(new Date(new Date().setDate(new Date().getDate() - 7))))
    const [end, setEnd] = useState(isoLocal(new Date()))
    const [data, setData] = useState([])
    const [planTotal, setPlanTotal] = useState(0)
    const [expenseTotal, setExpenseTotal] = useState(0)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)

    useEffect(() => {
        load()
    }, [period, start, end])

    async function load() {
        setLoading(true)
        setError(null)
        try {
            const qs = `?period=${encodeURIComponent(period)}&start=${encodeURIComponent(new Date(start).toISOString())}&end=${encodeURIComponent(new Date(end).toISOString())}`
            const body = await authFetch(`${endpoint}${qs}`)
            setData(body.data || [])

            try {
                const receipts = await listPlanReceipts()
                let purchases = []
                try {
                    if (user && user.role === 'director') {
                        const qs2 = `?start=${encodeURIComponent(new Date(start).toISOString())}&end=${encodeURIComponent(new Date(end).toISOString())}`
                        purchases = await authFetch(`/api/director/purchases${qs2}`)
                    } else {
                        purchases = await listPurchases()
                    }
                } catch (e) { console.warn('Failed to load purchases', e) }

                const s = new Date(start); s.setHours(0, 0, 0, 0)
                const e = new Date(end); e.setHours(23, 59, 59, 999)

                const planSum = (receipts || []).reduce((sum, r) => {
                    const d = r.paidAt ? new Date(r.paidAt) : new Date(r.createdAt || r.updatedAt || r._id)
                    if (d >= s && d <= e) return sum + (r.total || 0)
                    return sum
                }, 0)

                const expenseSum = (purchases || []).reduce((sum, p) => {
                    const d = p.purchasedAt ? new Date(p.purchasedAt) : new Date(p.createdAt || p.updatedAt || p._id)
                    if (d >= s && d <= e) return sum + (p.totalCost || 0)
                    return sum
                }, 0)

                setPlanTotal(Number(planSum.toFixed(2)))
                setExpenseTotal(Number(expenseSum.toFixed(2)))
            } catch (e) {
                console.warn('Failed to load receipts/purchases', e)
            }
        } catch (e) {
            console.error(e)
            setError(e.message || 'Error')
        } finally { setLoading(false) }
    }

    const totalRevenue = data.reduce((s, d) => s + (d.revenue || 0), 0)
    const totalExpenses = data.reduce((s, d) => s + (d.expense || 0), 0)
    const totalProfit = totalRevenue - totalExpenses

    return (
        <div className="p-8 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Financial Analytics</h1>
                    <p className="text-slate-500">Track revenue, subscriptions, and expenses.</p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 bg-white p-2 rounded-xl border border-slate-200 shadow-sm">
                    <select
                        value={period}
                        onChange={e => setPeriod(e.target.value)}
                        className="bg-slate-50 border-none rounded-lg text-sm font-medium text-slate-700 focus:ring-2 focus:ring-indigo-500/20"
                    >
                        <option value="day">Daily</option>
                        <option value="month">Monthly</option>
                        <option value="year">Yearly</option>
                    </select>
                    <div className="flex items-center gap-2">
                        <input type="date" value={start} onChange={e => setStart(e.target.value)} className="bg-slate-50 border-none rounded-lg text-sm text-slate-600" />
                        <span className="text-slate-400"><ArrowRight size={14} /></span>
                        <input type="date" value={end} onChange={e => setEnd(e.target.value)} className="bg-slate-50 border-none rounded-lg text-sm text-slate-600" />
                    </div>
                    <button
                        onClick={load}
                        disabled={loading}
                        className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-50"
                    >
                        {loading ? '...' : 'Update'}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-6 text-white shadow-lg">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm"><DollarSign size={24} /></div>
                        <span className="text-xs font-semibold bg-white/10 px-2 py-1 rounded">Total Revenue</span>
                    </div>
                    <div className="text-3xl font-bold mb-1">₹{totalRevenue.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
                    <div className="text-indigo-100 text-sm opacity-90">Total earnings in period</div>
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-2 bg-rose-50 text-rose-600 rounded-lg"><CreditCard size={24} /></div>
                        <span className="text-xs font-semibold text-rose-600 bg-rose-50 px-2 py-1 rounded">Operational Expenses</span>
                    </div>
                    <div className="text-3xl font-bold text-slate-800 mb-1">₹{totalExpenses.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
                    <div className="text-slate-400 text-sm">Global platform costs</div>
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><TrendingUp size={24} /></div>
                        <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-1 rounded">Net Profit</span>
                    </div>
                    <div className="text-3xl font-bold text-slate-800 mb-1">₹{totalProfit.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
                    <div className="text-slate-400 text-sm">Profit / Loss margin</div>
                </motion.div>
            </div>

            {error && <div className="p-4 bg-red-50 text-red-600 rounded-xl border border-red-100">{error}</div>}

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-slate-100 flex items-center gap-2">
                    <BarChart size={18} className="text-slate-400" />
                    <h3 className="font-semibold text-slate-800">Revenue Breakdown</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/50 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                <th className="px-6 py-4">Time Period</th>
                                <th className="px-6 py-4 text-right">Revenue Generated</th>
                                <th className="px-6 py-4 w-1/3">Trend</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {data.length === 0 ? (
                                <tr><td colSpan={3} className="p-8 text-center text-slate-400">No data available for this range.</td></tr>
                            ) : data.map((d, i) => (
                                <tr key={d.period} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="px-6 py-4 font-medium text-slate-700 flex items-center gap-2">
                                        <Calendar size={14} className="text-slate-400" />
                                        {d.period}
                                    </td>
                                    <td className="px-6 py-4 text-right font-bold text-indigo-600">₹{(d.revenue || 0).toFixed(2)}</td>
                                    <td className="px-6 py-4">
                                        {/* Simple visual bar */}
                                        <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-indigo-500 rounded-full opacity-80"
                                                style={{ width: `${Math.min(((d.revenue || 0) / (Math.max(...data.map(x => x.revenue)) || 1)) * 100, 100)}%` }}
                                            ></div>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
