import { useProfileRender } from '../../utils/profiler';
import React, { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { authFetch } from '../../services/api'
import { 
    Users, 
    Hospital, 
    Package, 
    AlertTriangle, 
    CheckCircle, 
    Clock, 
    XCircle, 
    DollarSign, 
    TrendingUp, 
    Activity, 
    Plus, 
    FileText, 
    ChevronRight, 
    CreditCard,
    MoreHorizontal,
    Building,
    Stethoscope,
    User,
    ArrowUpRight,
    ArrowDownRight,
    Calendar
} from 'lucide-react';
import { motion } from 'framer-motion'
import { Line } from 'react-chartjs-2'
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler
} from 'chart.js'

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler
)

import { useQuery } from '@tanstack/react-query'

const PremiumStatCard = React.memo(({ label, value, icon: Icon, color, trend, subtitle }) => {
    return (
        <motion.div
            whileHover={{ y: -5 }}
            className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 relative overflow-hidden group"
        >
            <div className={`absolute top-0 right-0 p-3 opacity-10 rounded-bl-3xl transition-transform group-hover:scale-150 duration-500`} style={{ backgroundColor: color }}>
                <Icon size={40} className="" style={{ color: color }} />
            </div>

            <div className="relative z-10">
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2.5 rounded-xl bg-slate-50 text-slate-600 group-hover:text-white group-hover:shadow-lg transition-all duration-300" style={{ '--tw-bg-opacity': 1, backgroundColor: `${color}15` }}>
                        <Icon size={20} style={{ color: color }} />
                    </div>
                    <span className="text-sm font-semibold text-slate-500 uppercase tracking-wider">{label}</span>
                </div>

                <div className="flex items-baseline gap-2 mt-2">
                    <h3 className="text-3xl font-bold text-slate-800 tracking-tight">{value}</h3>
                    {trend && (
                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5 ${trend > 0 ? 'text-emerald-600 bg-emerald-50' : 'text-rose-600 bg-rose-50'}`}>
                            {trend > 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                            {Math.abs(trend)}%
                        </span>
                    )}
                </div>
                {subtitle && <p className="text-xs text-slate-400 mt-2 font-medium">{subtitle}</p>}
            </div>

            <div className="absolute inset-0 border-2 border-transparent group-hover:border-indigo-50/50 rounded-2xl transition-colors pointer-events-none"></div>
        </motion.div>
    )
})

const TenantTable = React.memo(({ tenants, title, emptyMessage, icon: Icon, colorClass }) => {
    if (!tenants || tenants.length === 0) return (
        <div className="p-8 text-center text-slate-400 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
            <div className="flex justify-center mb-3">
                <div className={`p-3 rounded-full bg-slate-100 ${colorClass}`}>
                    <Icon size={24} className="opacity-70" />
                </div>
            </div>
            <p className="font-medium">{emptyMessage}</p>
        </div>
    )
    return (
        <div className="table-responsive">
            <table className="w-full text-left border-collapse">
                <thead>
                    <tr className="text-xs font-bold text-slate-400 border-b border-slate-100 uppercase tracking-wider">
                        <th className="px-6 py-4">Tenant Name</th>
                        <th className="px-6 py-4">Director</th>
                        <th className="px-6 py-4">Plan</th>
                        <th className="px-6 py-4">Expires On</th>
                        <th className="px-6 py-4 text-right">Status</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                    {tenants.map((t, i) => (
                        <motion.tr
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.05 }}
                            key={t.id}
                            className="hover:bg-slate-50/80 transition-colors group"
                        >
                            <td className="px-6 py-4 font-semibold text-slate-700">{t.name}</td>
                            <td className="px-6 py-4 text-sm text-slate-600">
                                {t.director ? (
                                    <div className="flex flex-col">
                                        <span className="font-medium text-slate-800">{t.director.name}</span>
                                        <span className="text-xs text-slate-400">{t.director.email}</span>
                                    </div>
                                ) : '-'}
                            </td>
                            <td className="px-6 py-4 text-sm">
                                <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-indigo-50 text-indigo-700 text-xs font-bold border border-indigo-100">
                                    {t.plan?.name || 'N/A'}
                                </span>
                            </td>
                            <td className="px-6 py-4 text-sm text-slate-500 font-medium">
                                {t.subscriptionEnd ? new Date(t.subscriptionEnd).toLocaleDateString() : 'Indefinite'}
                            </td>
                            <td className="px-6 py-4 text-right">
                                {t.status === 'active'
                                    ? <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600 text-xs font-bold border border-emerald-100"><CheckCircle size={12} /> Active</span>
                                    : <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-50 text-rose-600 text-xs font-bold border border-rose-100"><XCircle size={12} /> Expired</span>
                                }
                            </td>
                        </motion.tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
})

export default function DashboardPage() {
    useProfileRender('DashboardPage', true);
    const { token } = useAuth()
    const navigate = useNavigate()
    const [revRange, setRevRange] = useState('4m')

    // TanStack queries
    const { data: statsData, error: statsError, isLoading: statsLoading } = useQuery({
        queryKey: ['directorStats'],
        queryFn: () => authFetch('/api/director/stats'),
        enabled: !!token
    })

    const { data: tenantsData, error: tenantsError, isLoading: tenantsLoading } = useQuery({
        queryKey: ['tenantsUsage'],
        queryFn: () => authFetch('/api/director/tenants-usage'),
        enabled: !!token
    })

    const { data: plansData, isLoading: plansLoading } = useQuery({
        queryKey: ['plans'],
        queryFn: () => authFetch('/api/plans'),
        enabled: !!token
    })

    const { data: revenueData, isLoading: revenueLoading } = useQuery({
        queryKey: ['directorEarnings', revRange],
        queryFn: async () => {
            let period = 'month'
            const start = new Date()
            if (revRange === '7d') {
                period = 'day'
                start.setDate(start.getDate() - 7)
            } else if (revRange === '15d') {
                period = 'day'
                start.setDate(start.getDate() - 15)
            } else if (revRange === '1m') {
                period = 'day'
                start.setDate(start.getDate() - 30)
            } else if (revRange === '1y') {
                period = 'month'
                start.setFullYear(start.getFullYear() - 1)
            } else {
                period = 'month'
                start.setMonth(start.getMonth() - 4)
            }
            const qs = `?period=${period}&start=${start.toISOString()}`
            return authFetch(`/api/director/earnings${qs}`)
        },
        enabled: !!token
    })

    // Derived states
    const computedTenants = useMemo(() => {
        if (!tenantsData) return { expiring: [], expired: [], counts: {}, activeCount: 0, expiringCount: 0, expiredCount: 0 }
        const tenants = tenantsData.tenants || []
        const counts = {}
        let activeCount = 0
        let expiringCount = 0
        let expiredCount = 0
        const expiringList = []
        const expiredList = []

        const now = new Date()
        const soon = new Date(); soon.setDate(soon.getDate() + 14);

        for (const t of tenants) {
            const pid = t.plan && (t.plan.id || t.plan._id)
            if (pid) {
                counts[pid.toString()] = (counts[pid.toString()] || 0) + 1
            }

            if (t.subscriptionEnd) {
                const end = new Date(t.subscriptionEnd)
                if (end < now) {
                    expiredCount++
                    expiredList.push(t)
                } else {
                    activeCount++
                    if (end <= soon) {
                        expiringCount++
                        expiringList.push(t)
                    }
                }
            } else {
                if (t.status === 'active') activeCount++
                else if (t.status === 'expired') {
                    expiredCount++
                    expiredList.push(t)
                }
            }
        }
        return {
            expiring: expiringList,
            expired: expiredList,
            counts,
            activeCount,
            expiringCount,
            expiredCount
        }
    }, [tenantsData])

    const expiringTenants = computedTenants.expiring
    const expiredTenantsList = computedTenants.expired

    const plans = useMemo(() => {
        if (!plansData) return []
        const plansArr = plansData.plans || []
        const counts = computedTenants.counts
        return plansArr.map((p) => ({
            ...p,
            count: counts[p._id?.toString?.() || p._id] || 0
        }))
    }, [plansData, computedTenants.counts])

    const earningsData = useMemo(() => {
        if (!revenueData) return { labels: [], values: [] }
        const labels = (revenueData.data || []).map(d => {
            const parts = d.period.split('-')
            if (parts.length === 3) {
                const date = new Date(parts[0], Number(parts[1]) - 1, Number(parts[2]))
                return date.toLocaleString('default', { month: 'short', day: 'numeric' })
            } else if (parts.length === 2) {
                const date = new Date(parts[0], Number(parts[1]) - 1)
                return date.toLocaleString('default', { month: 'short' })
            }
            return d.period
        })
        const values = (revenueData.data || []).map(d => d.revenue)
        return { labels, values }
    }, [revenueData])

    const stats = useMemo(() => {
        const base = statsData || {}
        return {
            admins: base.admins ?? 0,
            patients: base.patients ?? 0,
            doctors: base.doctors ?? 0,
            staff: base.staff ?? 0,
            activeSubscriptions: base.activeSubscriptions ?? 0,
            financials: base.financials || { revenue: 0, expenses: 0, profit: 0 },
            earningsData,
            expiringSoon: computedTenants.expiringCount,
            expired: computedTenants.expiredCount
        }
    }, [statsData, earningsData, computedTenants.expiringCount, computedTenants.expiredCount])

    const loading = statsLoading || tenantsLoading || plansLoading || revenueLoading
    const error = statsError?.message || tenantsError?.message

    const chartData = useMemo(() => {
        return {
            labels: stats.earningsData?.labels?.length > 0 ? stats.earningsData.labels : [],
            datasets: [
                {
                    label: 'Revenue',
                    data: stats.earningsData?.values?.length > 0 ? stats.earningsData.values : [],
                    fill: true,
                    backgroundColor: 'rgba(99, 102, 241, 0.1)',
                    borderColor: 'rgb(99, 102, 241)',
                    tension: 0.4,
                },
            ],
        }
    }, [stats.earningsData])

    const chartOptions = useMemo(() => {
        return {
            responsive: true,
            plugins: {
                legend: { display: false },
                title: { display: false },
            },
            scales: {
                y: { display: false },
                x: { grid: { display: false } }
            }
        }
    }, [])

    return (
        <div className="p-4 md:p-8 space-y-6 md:space-y-8 pb-10">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Dashboard Overview</h1>
                    <p className="text-slate-500 mt-1 text-lg">Platform performance at a glance.</p>
                </div>
                <div className="flex gap-3">
                    <button onClick={() => window.location.reload()} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600 font-medium transition-colors shadow-sm">
                        <Activity size={18} />
                        <span>Refresh</span>
                    </button>
                    {/* Date Picker could go here */}
                </div>
            </div>

            {error && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 bg-red-50 text-red-600 rounded-xl border border-red-100 flex items-center gap-3"
                >
                    <AlertTriangle size={20} />
                    {error}
                </motion.div>
            )}

            {/* Key Business Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <PremiumStatCard
                    label="Total Revenue"
                    value={loading ? '...' : (stats.financials?.revenue ? `₹${Number(stats.financials.revenue).toLocaleString()} ` : '₹0')}
                    color="#10b981"
                    icon={DollarSign}
                    trend={12}
                    subtitle="Lifetime Earnings"
                />
                <PremiumStatCard
                    label="Operational Expenses"
                    value={loading ? '...' : (stats.financials?.expenses ? `₹${Number(stats.financials.expenses).toLocaleString()} ` : '₹0')}
                    color="#ef4444"
                    icon={CreditCard}
                    subtitle="Global Costs"
                />
                <PremiumStatCard
                    label="Net Profit"
                    value={loading ? '...' : (stats.financials?.profit ? `₹${Number(stats.financials.profit).toLocaleString()} ` : '₹0')}
                    color="#6366f1"
                    icon={TrendingUp}
                    subtitle="Total Margin"
                />
                <PremiumStatCard
                    label="Active Subscriptions"
                    value={loading ? '...' : (stats.activeSubscriptions ?? stats.admins ?? '-')}
                    color="#3b82f6"
                    icon={CheckCircle}
                    subtitle="Paying Hospitals"
                />
            </div>

            {/* Charts & Graphs Row (Placeholder for now, can be expanded) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
                        <h3 className="text-lg font-bold text-slate-800">Revenue Trends</h3>
                        <div className="flex bg-slate-100 p-1 rounded-lg">
                            {[
                                { id: '7d', label: '7D' },
                                { id: '15d', label: '15D' },
                                { id: '1m', label: '1M' },
                                { id: '4m', label: '4M' },
                                { id: '1y', label: '1Y' }
                            ].map(r => (
                                <button
                                    key={r.id}
                                    onClick={() => setRevRange(r.id)}
                                    className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${revRange === r.id ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    {r.label}
                                </button>
                            ))}
                        </div>
                        <button onClick={() => navigate('/director/expenses')} className="text-sm text-indigo-600 font-medium hover:underline">View Expenses</button>
                    </div>
                    <div className="h-64 w-full flex items-center justify-center">
                        {chartData.labels.length > 0 ? (
                            <Line options={chartOptions} data={chartData} />
                        ) : (
                            <div className="flex flex-col items-center gap-2 text-slate-400">
                                <Calendar size={40} className="opacity-20" />
                                <p className="text-sm font-medium">No revenue data for this period</p>
                            </div>
                        )}
                    </div>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-bold text-slate-800">Plan Distribution</h3>
                    </div>
                    <div className="space-y-4">
                        {plans.map((p, idx) => {
                            const colors = ['bg-emerald-500', 'bg-blue-500', 'bg-violet-500', 'bg-orange-500', 'bg-cyan-500']
                            const color = colors[idx % colors.length]
                            const total = plans.reduce((acc, curr) => acc + (curr.count || 0), 0) || 1
                            const percentage = Math.round(((p.count || 0) / total) * 100)

                            return (
                                <div key={p.id || idx}>
                                    <div className="flex justify-between text-sm mb-1.5">
                                        <span className="font-medium text-slate-700">{p.name}</span>
                                        <span className="text-slate-500">{p.count || 0} ({percentage}%)</span>
                                    </div>
                                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: `${percentage}%` }}
                                            transition={{ duration: 1, delay: 0.2 }}
                                            className={`h-full ${color}`}
                                        />
                                    </div>
                                </div>
                            )
                        })}
                        {plans.length === 0 && <p className="text-center text-slate-400 py-4">No plan data available</p>}
                    </div>
                </div>
            </div>

            {/* Expiring / Issues Section */}
            {(expiringTenants.length > 0 || expiredTenantsList.length > 0) && (
                <div className="grid grid-cols-1 gap-6">
                    {/* Combined Section for Alerts can go here if needed */}
                </div>
            )}

            {/* Tables Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Expiring Soon */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="px-6 py-5 border-b border-slate-50 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-amber-50 rounded-lg text-amber-600">
                                <Clock size={20} />
                            </div>
                            <h3 className="font-bold text-slate-800">Expiring Soon</h3>
                        </div>
                        <button className="text-slate-400 hover:text-slate-600"><MoreHorizontal size={20} /></button>
                    </div>
                    <TenantTable
                        tenants={expiringTenants}
                        emptyMessage="No subscriptions expiring soon."
                        icon={Clock}
                        colorClass="text-amber-500"
                    />
                </div>

                {/* Expired */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="px-6 py-5 border-b border-slate-50 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-rose-50 rounded-lg text-rose-600">
                                <AlertTriangle size={20} />
                            </div>
                            <h3 className="font-bold text-slate-800">Expired Subscriptions</h3>
                        </div>
                        <button className="text-slate-400 hover:text-slate-600"><MoreHorizontal size={20} /></button>
                    </div>
                    <TenantTable
                        tenants={expiredTenantsList}
                        emptyMessage="No expired subscriptions."
                        icon={AlertTriangle}
                        colorClass="text-rose-500"
                    />
                </div>
            </div>

            {/* Platform Scale Grid */}
            <div>
                <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                    <Activity size={24} className="text-indigo-600" />
                    System Scale
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    <PremiumStatCard label="Admins" value={loading ? '...' : stats.admins ?? 0} color="#6366f1" icon={Building} />
                    <PremiumStatCard label="Doctors" value={loading ? '...' : stats.doctors ?? 0} color="#06b6d4" icon={Stethoscope} />
                    <PremiumStatCard label="Staff" value={loading ? '...' : stats.staff ?? 0} color="#8b5cf6" icon={User} />
                    <PremiumStatCard label="Patients" value={loading ? '...' : stats.patients ?? 0} color="#ec4899" icon={Users} />
                </div>
            </div>
        </div>
    )
}
