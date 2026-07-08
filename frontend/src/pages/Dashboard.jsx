import { useProfileRender } from '../utils/profiler';

import { useEffect, useState, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate, useParams } from 'react-router-dom'
import { lowStock, dashboardSummary, salesLast7, getMyAppointments } from '../services/api'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import { Bar } from 'react-chartjs-2'
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Tooltip,
    Legend,
} from 'chart.js'
import { Pill, AlertTriangle, Clock, IndianRupee, Calendar, Stethoscope, Hash, Activity, ArrowRight, TrendingUp, User } from 'lucide-react'
import { motion } from 'framer-motion'
import PageContainer from '../components/Admin/PageContainer'
import PageHeader from '../components/Admin/PageHeader'
import StatsCard from '../components/Admin/StatsCard'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend)

const options = {
    plugins: { legend: { display: false } },
    responsive: true,
    maintainAspectRatio: false,
    scales: {
        x: { grid: { display: false } },
        y: { grid: { color: '#f3f4f6', borderDash: [5, 5] }, ticks: { padding: 10 } },
    },
    elements: {
        bar: {
            borderRadius: 8,
            borderSkipped: false,
        },
    },
}

export default function Dashboard() {
    useProfileRender('Dashboard', true);
    const { user } = useAuth()
    const { hospitalSlug: paramSlug } = useParams()
    const hospitalSlug = paramSlug || user?.tenantSlug || ''

    const navigate = useNavigate()
    const [shownLowStock, setShownLowStock] = useState(false)

    // TanStack Query integration
    const { data: summaryData, isLoading: summaryLoading } = useQuery({
        queryKey: ['dashboardSummary', hospitalSlug],
        queryFn: () => dashboardSummary(),
        enabled: !!user,
    })

    const { data: weeklyData, isLoading: weeklyLoading } = useQuery({
        queryKey: ['salesLast7', hospitalSlug],
        queryFn: () => salesLast7(),
        enabled: !!user,
    })

    const { data: myAppointmentsData, isLoading: myAppointmentsLoading } = useQuery({
        queryKey: ['myAppointments'],
        queryFn: () => getMyAppointments(),
        enabled: !!user,
    })

    const loading = summaryLoading || weeklyLoading
    const loadingAppts = myAppointmentsLoading

    const summary = useMemo(() => {
        const s = summaryData || {}
        return {
            totalPatients: s.totalPatients || 0,
            totalMedicines: s.totalMedicines || 0,
            lowStockCount: s.lowStockCount || 0,
            expiringSoonCount: s.expiringSoonCount || 0,
            todaySalesTotal: s.todaySalesTotal || 0,
            attendance: s.attendance || { present: 0, absent: 0, leave: 0, total: 0 },
            pendingLeaves: s.pendingLeaves || 0,
            hospitalName: s.hospitalName || '',
            hospitalSlug: s.hospitalSlug || ''
        }
    }, [summaryData])

    const weekly = useMemo(() => weeklyData || [], [weeklyData])
    const myAppointments = useMemo(() => myAppointmentsData || [], [myAppointmentsData])

    const cards = useMemo(() => {
        const list = [
            { label: 'Total Patients', value: (summary?.totalPatients || 0).toLocaleString(), icon: User, color: 'text-indigo-600', bg: 'bg-indigo-100', feature: 'Patients' },
            { label: 'Total Medicines', value: (summary?.totalMedicines || 0).toLocaleString(), icon: Pill, color: 'text-blue-600', bg: 'bg-blue-100', feature: 'Inventory' },
            { label: 'Low Stock Items', value: (summary?.lowStockCount || 0).toLocaleString(), icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-100', feature: 'Inventory' },
            { label: 'Expiring Soon', value: (summary?.expiringSoonCount || 0).toLocaleString(), icon: Clock, color: 'text-red-600', bg: 'bg-red-100', feature: 'Inventory' },
            { label: "Today's Sales", value: `₹${(Number(summary?.todaySalesTotal || 0)).toFixed(2)}`, icon: IndianRupee, color: 'text-emerald-600', bg: 'bg-emerald-100', feature: 'Billing' },
        ]

        if (user?.role === 'subadmin') {
            const features = user.features || []
            return list.filter(c => features.includes(c.feature))
        }
        return list
    }, [summary, user])

    const chartData = useMemo(() => ({
        labels: weekly.map(d => d.day.slice(5)),
        datasets: [{
            label: 'Sales',
            data: weekly.map(d => (d.revenue || 0)),
            backgroundColor: '#6366f1',
            hoverBackgroundColor: '#4f46e5',
            borderRadius: 8,
            barThickness: 32,
        }],
    }), [weekly])

    const { data: lowStockItems } = useQuery({
        queryKey: ['lowStock', 10],
        queryFn: () => lowStock(10),
        enabled: !!user,
    })

    useEffect(() => {
        if (shownLowStock || !lowStockItems) return
        if (Array.isArray(lowStockItems) && lowStockItems.length > 0) {
            const msg = lowStockItems.slice(0, 5).map(m => `${m.name} (${m.quantity})`).join(', ') + (lowStockItems.length > 5 ? '…' : '')
            toast.warn(`Low stock: ${msg}`)
        }
        setShownLowStock(true)
    }, [lowStockItems, shownLowStock])

    return (
        <PageContainer>
            <PageHeader
                title="Overview"
                actions={
                    <div className="flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg border border-blue-100 text-sm">
                        <span className="font-semibold">Public Portal:</span>
                        <a href={`${window.location.origin}/portal/${summary?.hospitalSlug || hospitalSlug || 'default'}`} target="_blank" rel="noopener noreferrer" className="hover:underline text-blue-800 truncate font-medium" title={`${window.location.origin}/portal/${summary?.hospitalSlug || hospitalSlug || ''}`}>
                            {summary?.hospitalName ? `${summary.hospitalName} Portal` : `${window.location.origin}/portal/${hospitalSlug || '...'}`}
                        </a>
                        <button className="p-1 hover:bg-blue-100 rounded ml-1" onClick={() => {
                            navigator.clipboard.writeText(`${window.location.origin}/portal/${summary?.hospitalSlug || hospitalSlug || ''}`)
                            toast.success('URL copied to clipboard')
                        }} title="Copy URL">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                        </button>
                    </div>
                }
            />

            {/* Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {cards.map((c, i) => (
                    <StatsCard
                        key={c.label}
                        {...c}
                        loading={loading}
                    />
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Sales Chart */}
                {(user?.role !== 'subadmin' || (user.features || []).includes('Reports')) && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-100 p-6"
                    >
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h3 className="text-lg font-bold text-slate-800">Revenue Analysis</h3>
                                <p className="text-sm text-slate-500">Weekly sales performance grouped by day</p>
                            </div>
                            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                                <TrendingUp size={20} />
                            </div>
                        </div>
                        <div className="h-72">
                            <Bar data={chartData} options={options} />
                        </div>
                    </motion.div>
                )}

                {/* Quick Actions */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col"
                >
                    <h3 className="text-lg font-bold text-slate-800 mb-6">Quick Actions</h3>
                    <div className="flex flex-col gap-4 flex-1">
                        {(user?.role !== 'subadmin' || (user.features || []).includes('Billing')) && (
                            <button
                                className="group relative overflow-hidden rounded-xl p-4 bg-gradient-to-br from-indigo-50 to-white border border-indigo-100 hover:border-indigo-300 transition-all text-left"
                                onClick={() => {
                                    const slug = hospitalSlug
                                    navigate(slug ? `/portal/${slug}/billing` : '/billing')
                                }}
                            >
                                <div className="flex items-center gap-4 relative z-10">
                                    <div className="w-12 h-12 rounded-xl bg-indigo-600 text-white grid place-items-center shadow-md group-hover:scale-110 transition-transform duration-300">
                                        <IndianRupee size={24} />
                                    </div>
                                    <div>
                                        <div className="font-bold text-slate-800 group-hover:text-indigo-700 transition-colors">New Billing Invoice</div>
                                        <div className="text-xs text-slate-500 font-medium mt-0.5">Process patient payment</div>
                                    </div>
                                    <ArrowRight className="ml-auto text-indigo-300 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all" size={20} />
                                </div>
                            </button>
                        )}

                        {(user?.role !== 'subadmin' || (user.features || []).includes('Inventory')) && (
                            <button
                                className="group relative overflow-hidden rounded-xl p-4 bg-gradient-to-br from-emerald-50 to-white border border-emerald-100 hover:border-emerald-300 transition-all text-left"
                                onClick={() => {
                                    const slug = hospitalSlug
                                    navigate(slug ? `/portal/${slug}/inventory?new=1` : '/inventory?new=1')
                                }}
                            >
                                <div className="flex items-center gap-4 relative z-10">
                                    <div className="w-12 h-12 rounded-xl bg-emerald-600 text-white grid place-items-center shadow-md group-hover:scale-110 transition-transform duration-300">
                                        <Pill size={24} />
                                    </div>
                                    <div>
                                        <div className="font-bold text-slate-800 group-hover:text-emerald-700 transition-colors">Add Medicine</div>
                                        <div className="text-xs text-slate-500 font-medium mt-0.5">Update pharmacy stock</div>
                                    </div>
                                    <ArrowRight className="ml-auto text-emerald-300 group-hover:text-emerald-600 group-hover:translate-x-1 transition-all" size={20} />
                                </div>
                            </button>
                        )}

                        {(user?.role !== 'subadmin' || (user.features || []).includes('Purchases')) && (
                            <button
                                className="group relative overflow-hidden rounded-xl p-4 bg-gradient-to-br from-amber-50 to-white border border-amber-100 hover:border-amber-300 transition-all text-left"
                                onClick={() => {
                                    const slug = hospitalSlug
                                    navigate(slug ? `/portal/${slug}/purchases?new=1` : '/purchases?new=1')
                                }}
                            >
                                <div className="flex items-center gap-4 relative z-10">
                                    <div className="w-12 h-12 rounded-xl bg-amber-600 text-white grid place-items-center shadow-md group-hover:scale-110 transition-transform duration-300">
                                        <Activity size={24} />
                                    </div>
                                    <div>
                                        <div className="font-bold text-slate-800 group-hover:text-amber-700 transition-colors">Purchase Order</div>
                                        <div className="text-xs text-slate-500 font-medium mt-0.5">Restock from suppliers</div>
                                    </div>
                                    <ArrowRight className="ml-auto text-amber-300 group-hover:text-amber-600 group-hover:translate-x-1 transition-all" size={20} />
                                </div>
                            </button>
                        )}
                    </div>
                </motion.div>
            </div>

            {/* Attendance and Leaves Overview */}
            {(user?.role === 'admin' || (user?.role === 'subadmin' && (user.features || []).includes('Staff'))) && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6"
                    >
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                <User className="text-blue-500" size={20} /> Today's Attendance
                            </h3>
                            <button onClick={() => navigate('/doctor-attendance')} className="text-sm font-medium text-blue-600 hover:underline">Manage</button>
                        </div>
                        <div className="flex items-center justify-around py-4">
                            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                                <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Present</div>
                                <div className="text-2xl font-bold text-emerald-600">{summary?.attendance?.present || 0}</div>
                            </div>
                            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                                <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Absent</div>
                                <div className="text-2xl font-bold text-red-600">{summary?.attendance?.absent || 0}</div>
                            </div>
                            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                                <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Leave</div>
                                <div className="text-2xl font-bold text-amber-600">{summary?.attendance?.leave || 0}</div>
                            </div>
                        </div>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex items-center justify-between"
                    >
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center text-amber-600">
                                <Calendar size={24} />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-slate-800">Pending Leaves</h3>
                                <p className="text-sm text-slate-500">{summary?.pendingLeaves || 0} requests awaiting approval</p>
                            </div>
                        </div>
                        <button
                            onClick={() => navigate('/leave-requests')}
                            className="btn btn-primary"
                        >
                            View Requests
                        </button>
                    </motion.div>
                </div>
            )}

            {/* Appointments Table */}
            {(user?.role !== 'subadmin' || (user.features || []).includes('Appointments')) && (
                <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden"
            >
                <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                        <Calendar className="text-blue-500" size={20} />
                        Upcoming Appointments
                    </h3>
                    <button onClick={() => {
                        const slug = hospitalSlug
                        navigate(slug ? `/portal/${slug}/appointments` : '/appointments')
                    }} className="text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline">
                        View All
                    </button>
                </div>
                {loadingAppts ? (
                    <div className="p-8 text-center text-slate-500 animate-pulse">Loading appointments...</div>
                ) : (
                    myAppointments.length === 0 ? (
                        <div className="p-12 text-center flex flex-col items-center gap-3">
                            <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center text-slate-400">
                                <Calendar size={24} />
                            </div>
                            <p className="text-slate-500">No upcoming appointments scheduled.</p>
                        </div>
                    ) : (
                        <div className="table-responsive">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-50/50 text-xs uppercase text-slate-500 font-bold tracking-wider">
                                    <tr>
                                        <th className="px-6 py-4">Date & Time</th>
                                        <th className="px-6 py-4">Doctor</th>
                                        <th className="px-6 py-4">Token</th>
                                        <th className="px-6 py-4">Mode</th>
                                        <th className="px-6 py-4">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {myAppointments.map(a => (
                                        <tr key={a._id} className="hover:bg-slate-50/80 transition-colors group">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs">
                                                        {new Date(a.slotStart).getDate()}
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-semibold text-slate-900">{new Date(a.slotStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                        <span className="text-xs text-slate-500">{new Date(a.slotStart).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <div className="p-1.5 rounded-full bg-indigo-50 text-indigo-600">
                                                        <Stethoscope size={14} />
                                                    </div>
                                                    <span className="text-sm font-medium text-slate-700">{a.doctor?.name || '—'}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono text-sm font-semibold bg-slate-100 px-2 py-0.5 rounded text-slate-600">#{a.tokenNumber}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${a.type === 'video' ? 'bg-purple-50 text-purple-700' : 'bg-slate-100 text-slate-700'
                                                    }`}>
                                                    {a.type === 'video' ? 'Video Call' : 'In-Person'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${a.status === 'completed' ? 'bg-green-50 text-green-700 border-green-100' :
                                                    a.status === 'scheduled' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                                                        'bg-slate-50 text-slate-600 border-slate-100'
                                                    }`}>
                                                    <div className={`w-1.5 h-1.5 rounded-full mr-1.5 ${a.status === 'completed' ? 'bg-green-500' :
                                                        a.status === 'scheduled' ? 'bg-blue-500' :
                                                            'bg-slate-400'
                                                        }`}></div>
                                                    {a.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )
                )}
            </motion.div>
            )}
        </PageContainer>
    )
}

