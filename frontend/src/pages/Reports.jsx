import { useProfileRender } from '../utils/profiler';

import { useState, useEffect, useMemo } from 'react'
import { Bar } from 'react-chartjs-2'
import { salesMonthly, stockFull, expirySoonExact } from '../services/api'
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Tooltip,
    Legend,
} from 'chart.js'
import { motion, AnimatePresence } from 'framer-motion'
import { BarChart2, Package, AlertTriangle, TrendingUp } from 'lucide-react'
import PageContainer from '../components/Admin/PageContainer'
import PageHeader from '../components/Admin/PageHeader'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend)

const tabs = [
    { id: 'Sales Report', icon: TrendingUp },
    { id: 'Stock Report', icon: Package },
    { id: 'Expiry Report', icon: AlertTriangle },
]

export default function Reports() {
    useProfileRender('Reports', true);
    const [active, setActive] = useState('Sales Report')
    const [monthly, setMonthly] = useState([])
    const [stock, setStock] = useState([])
    const [expiry, setExpiry] = useState([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)
    const [range, setRange] = useState('1y')

    useEffect(() => {
        setLoading(true); setError(null)
        const loadOther = async () => {
            try {
                const [s, e] = await Promise.all([stockFull(), expirySoonExact(4)])
                setStock(s); setExpiry(e)
            } catch (e) { console.warn('Background load error', e) }
        }
        loadOther()
    }, [])

    useEffect(() => {
        loadSales()
    }, [range])

    async function loadSales() {
        setLoading(true); setError(null)
        try {
            let period = 'month'
            const start = new Date()
            if (range === '7d') { period = 'day'; start.setDate(start.getDate() - 7) }
            else if (range === '15d') { period = 'day'; start.setDate(start.getDate() - 15) }
            else if (range === '1m') { period = 'day'; start.setDate(start.getDate() - 30) }
            else if (range === '4m') { period = 'month'; start.setMonth(start.getMonth() - 4) }
            else { period = 'month'; start.setFullYear(start.getFullYear() - 1) }

            const data = await salesMonthly(`?period=${period}&start=${start.toISOString()}`)
            setMonthly(data)
        } catch (e) {
            setError(e.message || 'Failed to load sales report')
        } finally { setLoading(false) }
    }

    const salesChart = useMemo(() => {
        const byMonth = monthly.reduce((acc, r) => {
            acc[r.month] = (acc[r.month] || 0) + (r.revenue || 0)
            return acc
        }, {})
        const labels = Object.keys(byMonth).sort()
        return {
            labels: labels.map(l => {
                const parts = l.split('-')
                if (parts.length === 3) {
                    const date = new Date(parts[0], Number(parts[1]) - 1, Number(parts[2]))
                    return date.toLocaleString('default', { month: 'short', day: 'numeric' })
                } else if (parts.length === 2) {
                    const date = new Date(parts[0], Number(parts[1]) - 1)
                    return date.toLocaleString('default', { month: 'short' })
                }
                return l
            }),
            datasets: [{
                label: 'Revenue (₹)',
                data: labels.map(l => byMonth[l] / 100),
                backgroundColor: '#6366f1',
                hoverBackgroundColor: '#4f46e5',
                borderRadius: 8,
                barThickness: range.includes('d') ? 20 : 40
            }]
        }
    }, [monthly, range])

    const chartOptions = {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
            x: { grid: { display: false } },
            y: { grid: { color: '#f3f4f6', borderDash: [5, 5] }, ticks: { padding: 10 } }
        }
    }

    return (
        <PageContainer>
            <PageHeader title="Reports & Analytics" breadcrumbs={[{ label: 'Dashboard', to: '/' }, { label: 'Reports' }]} />

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <div className="flex gap-2 bg-slate-100 p-1 rounded-xl w-fit">
                    {tabs.map(t => {
                        const Icon = t.icon
                        return (
                            <button
                                key={t.id}
                                onClick={() => setActive(t.id)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${active === t.id
                                    ? 'bg-white text-blue-600 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                                    }`}
                            >
                                <Icon size={16} />
                                {t.id}
                            </button>
                        )
                    })}
                </div>

                {active === 'Sales Report' && (
                    <div className="flex gap-1 bg-white border border-slate-200 p-1 rounded-xl shadow-sm">
                        {['7d', '15d', '1m', '4m', '1y'].map(r => (
                            <button
                                key={r}
                                onClick={() => setRange(r)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${range === r ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                            >
                                {r.toUpperCase()}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {error && <div className="bg-red-50 text-red-700 px-4 py-3 rounded-xl border border-red-100 mb-6 flex items-center gap-2"><AlertTriangle size={18} /> {error}</div>}

            {loading ? (
                <div className="p-12 text-center text-slate-500 flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                    <p>Generating reports...</p>
                </div>
            ) : (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden min-h-[500px]">
                    <AnimatePresence mode="wait">
                        {active === 'Sales Report' && (
                            <motion.div
                                key="sales"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ duration: 0.2 }}
                                className="p-6 md:p-8 space-y-8"
                            >
                                <div>
                                    <div className="flex justify-between items-end mb-6">
                                        <div>
                                            <h3 className="text-lg font-bold text-slate-800 mb-1">Revenue Overview</h3>
                                            <p className="text-sm text-slate-500">Trends for the selected range: {range.toUpperCase()}</p>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-2xl font-black text-indigo-600">₹{(monthly.reduce((s, r) => s + (r.revenue || 0), 0) / 100).toLocaleString()}</div>
                                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total in range (Rupees)</div>
                                        </div>
                                    </div>
                                    <div className="h-80 w-full mb-8">
                                        <Bar data={salesChart} options={{ ...chartOptions, maintainAspectRatio: false }} />
                                    </div>
                                </div>

                                <div>
                                    <h3 className="font-bold text-slate-800 mb-4">Detailed Breakdown</h3>
                                    <div className="overflow-x-auto border rounded-xl">
                                        <table className="w-full text-sm text-left">
                                            <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-500">
                                                <tr>
                                                    <th className="px-6 py-4">{range.includes('d') ? 'Day' : 'Month'}</th>
                                                    <th className="px-6 py-4">Medicine</th>
                                                    <th className="px-6 py-4 text-right">Qty Sold</th>
                                                    <th className="px-6 py-4 text-right">Revenue (₹)</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {monthly.length === 0 ? (
                                                    <tr><td colSpan={4} className="px-6 py-8 text-center text-slate-500">No sales data recorded yet.</td></tr>
                                                ) : monthly.map((r, i) => (
                                                    <tr key={i} className="hover:bg-slate-50 transition-colors">
                                                        <td className="px-6 py-3 font-medium text-slate-700">{r.month}</td>
                                                        <td className="px-6 py-3 text-slate-600">{r.medicine}</td>
                                                        <td className="px-6 py-3 text-right text-slate-600">{r.quantitySold}</td>
                                                        <td className="px-6 py-3 text-right font-bold text-slate-800">₹{(r.revenue / 100).toFixed(2)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                        {/* Stock Report tab content */}
                        {active === 'Stock Report' && (
                            <motion.div
                                key="stock"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ duration: 0.2 }}
                                className="p-0"
                            >
                                <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50">
                                    <h3 className="font-bold text-slate-800">Current Stock Inventory</h3>
                                    <p className="text-xs text-slate-500 mt-1">Real-time stock levels across all medicines</p>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-white border-b border-slate-100 text-xs font-bold text-slate-500 uppercase tracking-wider">
                                            <tr>
                                                <th className="px-6 py-4">Name</th>
                                                <th className="px-6 py-4">Batch</th>
                                                <th className="px-6 py-4 text-right">Qty</th>
                                                <th className="px-6 py-4 text-right">Reorder Level</th>
                                                <th className="px-6 py-4 text-right">Sell Price</th>
                                                <th className="px-6 py-4 text-right">Expiry</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50 max-h-[600px] overflow-y-auto">
                                            {stock.length === 0 ? (
                                                <tr><td colSpan={6} className="px-6 py-8 text-center text-slate-500">Inventory is empty.</td></tr>
                                            ) : stock.map(m => (
                                                <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                                                    <td className="px-6 py-3 font-semibold text-slate-700">{m.name}</td>
                                                    <td className="px-6 py-3 text-slate-500 font-mono text-xs">{m.batch}</td>
                                                    <td className={`px-6 py-3 text-right font-bold ${m.quantity <= m.reorderLevel ? 'text-red-500' : 'text-slate-700'}`}>
                                                        {m.quantity}
                                                    </td>
                                                    <td className="px-6 py-3 text-right text-slate-500">{m.reorderLevel}</td>
                                                    <td className="px-6 py-3 text-right text-slate-700">₹{Number(m.sellingPrice).toFixed(2)}</td>
                                                    <td className="px-6 py-3 text-right text-slate-500">{new Date(m.expiryDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </motion.div>
                        )}
                        {/* Expiry Report tab content */}
                        {active === 'Expiry Report' && (
                            <motion.div
                                key="expiry"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ duration: 0.2 }}
                                className="p-0"
                            >
                                <div className="px-6 py-5 border-b border-slate-100 bg-red-50/50">
                                    <h3 className="font-bold text-red-700 flex items-center gap-2">
                                        <AlertTriangle size={18} /> Expiry Warnings
                                    </h3>
                                    <p className="text-xs text-red-600/80 mt-1">Medicines expiring within next 4 days or already expired</p>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-white border-b border-slate-100 text-xs font-bold text-slate-500 uppercase tracking-wider">
                                            <tr>
                                                <th className="px-6 py-4">Name</th>
                                                <th className="px-6 py-4">Batch</th>
                                                <th className="px-6 py-4 text-right">Qty</th>
                                                <th className="px-6 py-4 text-right">Expiry Date</th>
                                                <th className="px-6 py-4 text-center">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {expiry.length === 0 ? (
                                                <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-500 text-base">No immediate expirations found. Good job!</td></tr>
                                            ) : expiry.map(e => (
                                                <tr key={e.id} className="hover:bg-slate-50 transition-colors">
                                                    <td className="px-6 py-3 font-medium text-slate-700">{e.name}</td>
                                                    <td className="px-6 py-3 text-slate-500 font-mono text-xs">{e.batch}</td>
                                                    <td className="px-6 py-3 text-right text-slate-700">{e.quantity}</td>
                                                    <td className="px-6 py-3 text-right font-medium text-red-600">{new Date(e.expiryDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                                                    <td className="px-6 py-3 text-center">
                                                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${e.expired
                                                            ? 'bg-red-100 text-red-700 border border-red-200'
                                                            : 'bg-amber-100 text-amber-700 border border-amber-200'
                                                            }`}>
                                                            {e.expired ? 'EXPIRED' : 'EXPIRING SOON'}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            )}
        </PageContainer>
    )
}

