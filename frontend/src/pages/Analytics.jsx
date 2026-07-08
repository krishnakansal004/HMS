import { useProfileRender } from '../utils/profiler';
import React, { useState, useEffect } from 'react';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend } from 'chart.js';
import { toast } from 'react-toastify';
import { TrendingUp, RefreshCw, Layers, ShoppingBag, Beaker, UserCheck } from 'lucide-react';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend);

export default function Analytics() {
    useProfileRender('Analytics', true);
    const [summaryData, setSummaryData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [recompiling, setRecompiling] = useState(false);

    const fetchSummary = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/analytics/summary', {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('hms.auth.token')}` }
            });
            if (res.ok) setSummaryData(await res.json());
        } catch (e) { toast.error('Failed to load analytics data'); }
        setLoading(false);
    };

    const handleRecompile = async () => {
        setRecompiling(true);
        try {
            const res = await fetch('/api/analytics/recompile', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('hms.auth.token')}` }
            });
            if (res.ok) {
                toast.success('Business intelligence data updated successfully');
                fetchSummary();
            }
        } catch (e) { toast.error('Recompile request failed'); }
        setRecompiling(false);
    };

    useEffect(() => {
        fetchSummary();
    }, []);

    // Prepare chart configs
    const labels = summaryData.map(d => d.date);

    const revenueChartData = {
        labels,
        datasets: [{
            label: 'Daily Earnings (INR)',
            data: summaryData.map(d => d.revenue),
            borderColor: '#6366f1',
            backgroundColor: 'rgba(99, 102, 241, 0.1)',
            fill: true,
            tension: 0.3
        }]
    };

    const pharmacyAndLabChartData = {
        labels,
        datasets: [
            {
                label: 'Pharmacy Sales (INR)',
                data: summaryData.map(d => d.pharmacySales),
                backgroundColor: '#f43f5e'
            },
            {
                label: 'LIS Orders Count',
                data: summaryData.map(d => d.labsCount * 100), // Scaled to read well together
                backgroundColor: '#0ea5e9'
            }
        ]
    };

    // Aggregate doctor stats
    const doctorStatsMap = {};
    summaryData.forEach(d => {
        if (Array.isArray(d.doctorStats)) {
            d.doctorStats.forEach(doc => {
                doctorStatsMap[doc.name] = (doctorStatsMap[doc.name] || 0) + doc.count;
            });
        }
    });

    const docLabels = Object.keys(doctorStatsMap);
    const docData = Object.values(doctorStatsMap);

    const doctorChartData = {
        labels: docLabels.length > 0 ? docLabels : ['General Practice'],
        datasets: [{
            data: docData.length > 0 ? docData : [10],
            backgroundColor: ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6']
        }]
    };

    // Calculate aggregated totals
    const totalRevenue = summaryData.reduce((sum, d) => sum + d.revenue, 0);
    const totalPharmacy = summaryData.reduce((sum, d) => sum + d.pharmacySales, 0);
    const totalLabs = summaryData.reduce((sum, d) => sum + d.labsCount, 0);
    const avgOccupancy = summaryData.length > 0 ? (summaryData.reduce((sum, d) => sum + d.occupancyRate, 0) / summaryData.length) : 0;

    return (
        <div className="p-6 space-y-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/60 backdrop-blur-md p-6 rounded-2xl border border-slate-100 shadow-sm">
                <div>
                    <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight flex items-center gap-3">
                        <TrendingUp className="text-indigo-600 animate-pulse" size={32} />
                        Advanced Analytics & BI Dashboard
                    </h1>
                    <p className="text-slate-500 font-medium mt-1">Aggregated clinical and financial data for business intelligence reporting.</p>
                </div>
                <button
                    disabled={recompiling}
                    onClick={handleRecompile}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 py-2.5 rounded-xl transition-all shadow-lg hover:scale-[1.02] flex items-center gap-2 cursor-pointer disabled:opacity-55"
                >
                    <RefreshCw className={recompiling ? 'animate-spin' : ''} size={18} />
                    Sync Analytics data
                </button>
            </div>

            {/* Summaries Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-indigo-50 text-indigo-700 rounded-xl">
                        <TrendingUp size={24} />
                    </div>
                    <div>
                        <span className="text-xs text-slate-400 font-bold block uppercase tracking-wider">Total Revenue</span>
                        <span className="text-2xl font-black text-slate-800 mt-1">₹{totalRevenue.toLocaleString()}</span>
                    </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
                        <ShoppingBag size={24} />
                    </div>
                    <div>
                        <span className="text-xs text-slate-400 font-bold block uppercase tracking-wider">Pharmacy Sales</span>
                        <span className="text-2xl font-black text-slate-800 mt-1">₹{totalPharmacy.toLocaleString()}</span>
                    </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-sky-50 text-sky-600 rounded-xl">
                        <Beaker size={24} />
                    </div>
                    <div>
                        <span className="text-xs text-slate-400 font-bold block uppercase tracking-wider">LIS Lab Tests</span>
                        <span className="text-2xl font-black text-slate-800 mt-1">{totalLabs} Orders</span>
                    </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                        <Layers size={24} />
                    </div>
                    <div>
                        <span className="text-xs text-slate-400 font-bold block uppercase tracking-wider">Avg Occupancy</span>
                        <span className="text-2xl font-black text-slate-800 mt-1">{avgOccupancy.toFixed(1)}%</span>
                    </div>
                </div>
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Revenue Line Chart */}
                <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                    <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                        Earnings stream (Last 30 Days)
                    </h3>
                    <div className="h-72 flex items-center justify-center">
                        {loading ? <p className="text-slate-400">Loading...</p> : <Line data={revenueChartData} options={{ responsive: true, maintainAspectRatio: false }} />}
                    </div>
                </div>

                {/* Doctor Consult Volume */}
                <div className="lg:col-span-1 bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                    <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                        <UserCheck size={18} className="text-indigo-600" /> Doctor Volume Share
                    </h3>
                    <div className="h-72 flex items-center justify-center">
                        {loading ? <p className="text-slate-400">Loading...</p> : <Doughnut data={doctorChartData} options={{ responsive: true, maintainAspectRatio: false }} />}
                    </div>
                </div>

                {/* Pharmacy Sales vs Lab Volume */}
                <div className="lg:col-span-3 bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                    <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                        Clinical Sales vs LIS Orders Correlation
                    </h3>
                    <div className="h-80 flex items-center justify-center">
                        {loading ? <p className="text-slate-400">Loading...</p> : <Bar data={pharmacyAndLabChartData} options={{ responsive: true, maintainAspectRatio: false }} />}
                    </div>
                </div>
            </div>
        </div>
    );
}

