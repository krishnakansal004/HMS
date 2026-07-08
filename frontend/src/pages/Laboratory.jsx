import { useProfileRender } from '../utils/profiler';
import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import { Activity, Beaker, Plus, CheckCircle, Clock, FileDown, Search, ArrowRight, User } from 'lucide-react';

export default function Laboratory() {
    useProfileRender('Laboratory', true);
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState(user?.role === 'patient' ? 'my-reports' : 'orders');
    const [search, setSearch] = useState('');

    // Form states
    const [showTestModal, setShowTestModal] = useState(false);
    const [newTest, setNewTest] = useState({ name: '', code: '', category: 'Blood Work', sampleType: 'Blood', price: '', parameters: '' });
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [resultsDraft, setResultsDraft] = useState([]);
    const [loading, setLoading] = useState(false);

    const { data: testsData, isLoading: testsLoading } = useQuery({
        queryKey: ['labTests'],
        queryFn: async () => {
            const res = await fetch('/api/lab/tests', {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('hms.auth.token')}` }
            });
            if (!res.ok) throw new Error('Failed to load tests catalog');
            return res.json();
        }
    });

    const { data: ordersData, isLoading: ordersLoading } = useQuery({
        queryKey: ['labOrders'],
        queryFn: async () => {
            const res = await fetch('/api/lab/orders', {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('hms.auth.token')}` }
            });
            if (!res.ok) throw new Error('Failed to load lab orders');
            return res.json();
        }
    });

    const tests = useMemo(() => Array.isArray(testsData) ? testsData : [], [testsData]);
    const orders = useMemo(() => Array.isArray(ordersData) ? ordersData : [], [ordersData]);

    const handleCreateTest = async (e) => {
        e.preventDefault();
        try {
            const paramsArray = newTest.parameters.split(',').map(p => ({ name: p.trim(), unit: '', range: '' }));
            const res = await fetch('/api/lab/tests', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('hms.auth.token')}`
                },
                body: JSON.stringify({ ...newTest, parameters: paramsArray })
            });
            if (res.ok) {
                toast.success('Lab test created successfully');
                setShowTestModal(false);
                setNewTest({ name: '', code: '', category: 'Blood Work', sampleType: 'Blood', price: '', parameters: '' });
                queryClient.invalidateQueries({ queryKey: ['labTests'] });
            } else {
                const err = await res.json();
                toast.error(err.error || 'Failed to create test');
            }
        } catch (e) { toast.error('Server error'); }
    };

    const handleUpdateSampleStatus = async (orderId, currentStatus) => {
        const nextStatusMap = {
            'pending': 'collected',
            'collected': 'received',
            'received': 'processing'
        };
        const nextStatus = nextStatusMap[currentStatus];
        if (!nextStatus) return;

        try {
            const res = await fetch(`/api/lab/orders/${orderId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('hms.auth.token')}`
                },
                body: JSON.stringify({ sampleStatus: nextStatus, trackingStatus: `Sample ${nextStatus.toUpperCase()}` })
            });
            if (res.ok) {
                toast.success(`Order status updated to ${nextStatus}`);
                queryClient.invalidateQueries({ queryKey: ['labOrders'] });
            }
        } catch (e) { toast.error('Status update failed'); }
    };

    const handleOpenResults = (order) => {
        setSelectedOrder(order);
        setResultsDraft(order.results || []);
    };

    const handleSaveResults = async () => {
        try {
            const res = await fetch(`/api/lab/orders/${selectedOrder._id}/results`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('hms.auth.token')}`
                },
                body: JSON.stringify({ results: resultsDraft, technicianNotes: 'Values verified locally' })
            });
            if (res.ok) {
                toast.success('Results drafted successfully');
                setSelectedOrder(null);
                queryClient.invalidateQueries({ queryKey: ['labOrders'] });
            }
        } catch (e) { toast.error('Failed to draft results'); }
    };

    const handleVerifyResults = async (orderId) => {
        setLoading(true);
        try {
            const res = await fetch(`/api/lab/orders/${orderId}/verify`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('hms.auth.token')}` }
            });
            if (res.ok) {
                toast.success('Order completed and verified. PDF generated.');
                queryClient.invalidateQueries({ queryKey: ['labOrders'] });
            }
        } catch (e) { toast.error('Verification failed'); }
        setLoading(false);
    };

    const filteredOrders = orders.filter(o =>
        o.patientName?.toLowerCase().includes(search.toLowerCase()) ||
        o.testName?.toLowerCase().includes(search.toLowerCase()) ||
        o.barcode?.includes(search)
    );

    return (
        <div className="p-6 space-y-6 max-w-7xl mx-auto">
            {/* Header section with glassmorphism */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/60 backdrop-blur-md p-6 rounded-2xl border border-slate-100 shadow-sm">
                <div>
                    <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight flex items-center gap-3">
                        <Beaker className="text-indigo-600 animate-pulse" size={32} />
                        Laboratory Information System
                    </h1>
                    <p className="text-slate-500 font-medium mt-1">Manage tests catalog, sample lifecycles, and pathologist verification.</p>
                </div>
                {user?.role !== 'patient' && (
                    <div className="flex gap-2">
                        <button
                            onClick={() => setShowTestModal(true)}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 py-2.5 rounded-xl transition-all shadow-lg shadow-indigo-100 hover:scale-[1.02] flex items-center gap-2 cursor-pointer"
                        >
                            <Plus size={18} />
                            Create Test
                        </button>
                    </div>
                )}
            </div>

            {/* Navigation Tabs */}
            <div className="flex gap-2 bg-slate-100 p-1 rounded-xl w-fit">
                {user?.role !== 'patient' && (
                    <>
                        <button
                            onClick={() => setActiveTab('orders')}
                            className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all cursor-pointer ${activeTab === 'orders' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-600 hover:text-slate-800'}`}
                        >
                            Lab Orders
                        </button>
                        <button
                            onClick={() => setActiveTab('catalog')}
                            className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all cursor-pointer ${activeTab === 'catalog' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-600 hover:text-slate-800'}`}
                        >
                            Tests Catalog
                        </button>
                    </>
                )}
                {user?.role === 'patient' && (
                    <button
                        onClick={() => setActiveTab('my-reports')}
                        className="bg-white text-slate-800 px-4 py-2 rounded-lg font-semibold text-sm shadow-sm"
                    >
                        My Digital Reports
                    </button>
                )}
            </div>

            {/* Search filter */}
            {activeTab === 'orders' && (
                <div className="relative max-w-md">
                    <Search className="absolute left-3 top-3.5 text-slate-400" size={18} />
                    <input
                        type="text"
                        placeholder="Search by patient, test or barcode..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="pl-10 pr-4 py-2.5 w-full bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700 shadow-sm"
                    />
                </div>
            )}

            {/* LIS Orders Tab Content */}
            {activeTab === 'orders' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Orders List */}
                    <div className="lg:col-span-2 space-y-4">
                        {filteredOrders.length === 0 ? (
                            <div className="bg-white/80 p-8 rounded-2xl border text-center text-slate-500">
                                No active lab orders found.
                            </div>
                        ) : (
                            filteredOrders.map(o => (
                                <div key={o._id} className="bg-white hover:border-indigo-100 p-5 rounded-2xl border border-slate-100 shadow-sm transition-all flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs bg-indigo-50 text-indigo-700 font-bold px-2.5 py-0.5 rounded-full">{o.testCode}</span>
                                            <span className="text-xs bg-slate-100 text-slate-700 font-semibold px-2.5 py-0.5 rounded-full">{o.barcode}</span>
                                        </div>
                                        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                            <User size={16} className="text-slate-400" />
                                            {o.patientName}
                                        </h3>
                                        <p className="text-slate-600 font-semibold text-sm">{o.testName}</p>
                                        <p className="text-slate-400 text-xs">Ordered By: {o.doctorName}</p>
                                    </div>

                                    {/* Action states based on workflow */}
                                    <div className="flex flex-wrap gap-2 items-center">
                                        {/* Status badge */}
                                        <div className="flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full border bg-slate-50 border-slate-200 text-slate-600">
                                            <Clock size={12} />
                                            {o.sampleStatus.toUpperCase()}
                                        </div>

                                        {/* Progress transitions */}
                                        {o.sampleStatus === 'pending' && (
                                            <button
                                                onClick={() => handleUpdateSampleStatus(o._id, o.sampleStatus)}
                                                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3.5 py-2 rounded-xl flex items-center gap-1 transition-all cursor-pointer"
                                            >
                                                Collect Sample <ArrowRight size={12} />
                                            </button>
                                        )}
                                        {o.sampleStatus === 'collected' && (
                                            <button
                                                onClick={() => handleUpdateSampleStatus(o._id, o.sampleStatus)}
                                                className="bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold px-3.5 py-2 rounded-xl flex items-center gap-1 transition-all cursor-pointer"
                                            >
                                                Mark Received <ArrowRight size={12} />
                                            </button>
                                        )}
                                        {o.sampleStatus === 'received' && (
                                            <button
                                                onClick={() => handleOpenResults(o)}
                                                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3.5 py-2 rounded-xl flex items-center gap-1 transition-all cursor-pointer"
                                            >
                                                Enter Results
                                            </button>
                                        )}
                                        {o.sampleStatus === 'processing' && (
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => handleOpenResults(o)}
                                                    className="bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold px-3 py-2 rounded-xl cursor-pointer"
                                                >
                                                    Edit
                                                </button>
                                                <button
                                                    onClick={() => handleVerifyResults(o._id)}
                                                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3.5 py-2 rounded-xl flex items-center gap-1 transition-all cursor-pointer"
                                                >
                                                    Verify Results <CheckCircle size={12} />
                                                </button>
                                            </div>
                                        )}
                                        {o.sampleStatus === 'completed' && o.reportUrl && (
                                            <a
                                                href={o.reportUrl}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1 transition-all"
                                            >
                                                <FileDown size={14} /> Download Report
                                            </a>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Right column: active Result editor panel */}
                    <div className="lg:col-span-1">
                        {selectedOrder ? (
                            <div className="bg-white/80 backdrop-blur-md p-6 rounded-2xl border border-slate-100 shadow-lg space-y-4 sticky top-6">
                                <div>
                                    <h3 className="font-extrabold text-slate-800 text-lg">Enter Test Parameters</h3>
                                    <p className="text-slate-500 text-xs">{selectedOrder.patientName} - {selectedOrder.testName}</p>
                                </div>
                                <div className="space-y-3">
                                    {resultsDraft.map((p, idx) => (
                                        <div key={idx} className="space-y-1">
                                            <label className="text-xs font-bold text-slate-500 block">{p.name}</label>
                                            <div className="flex gap-2">
                                                <input
                                                    type="text"
                                                    value={p.value}
                                                    onChange={e => {
                                                        const copy = [...resultsDraft];
                                                        copy[idx].value = e.target.value;
                                                        setResultsDraft(copy);
                                                    }}
                                                    placeholder="Value"
                                                    className="px-3 py-2 border rounded-xl w-full text-sm bg-white"
                                                />
                                                <span className="text-xs text-slate-400 flex items-center font-semibold">{p.unit || 'units'}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="flex gap-2 pt-2">
                                    <button
                                        onClick={handleSaveResults}
                                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-2 px-4 rounded-xl w-full cursor-pointer"
                                    >
                                        Save Results Draft
                                    </button>
                                    <button
                                        onClick={() => setSelectedOrder(null)}
                                        className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs py-2 px-4 rounded-xl cursor-pointer"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-slate-50/50 p-6 rounded-2xl border border-dashed border-slate-200 text-center text-slate-400">
                                Select a received/processing order to input diagnostic observations.
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Catalog Tab Content */}
            {activeTab === 'catalog' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {tests.map(t => (
                        <div key={t._id} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-3">
                            <div className="flex justify-between items-start">
                                <span className="text-xs bg-indigo-50 text-indigo-700 font-bold px-2 py-0.5 rounded-md">{t.code}</span>
                                <span className="text-sm font-bold text-emerald-600">₹{t.price}</span>
                            </div>
                            <div>
                                <h3 className="font-extrabold text-slate-800 text-lg">{t.name}</h3>
                                <p className="text-slate-400 text-xs">Sample Type: {t.sampleType}</p>
                            </div>
                            <div className="border-t pt-2 space-y-1">
                                <span className="text-xs font-bold text-slate-400 block">Parameters Measured:</span>
                                <div className="flex flex-wrap gap-1">
                                    {t.parameters.map((p, idx) => (
                                        <span key={idx} className="text-xs bg-slate-50 text-slate-600 px-2 py-0.5 rounded-full border">{p.name || p}</span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Patient reports view */}
            {activeTab === 'my-reports' && (
                <div className="bg-white p-6 rounded-2xl border shadow-sm space-y-4">
                    <h2 className="text-xl font-bold text-slate-800">My Completed Laboratory Investigations</h2>
                    <div className="space-y-3">
                        {orders.filter(o => o.sampleStatus === 'completed').length === 0 ? (
                            <p className="text-slate-500 text-center py-6">No completed reports ready for download.</p>
                        ) : (
                            orders.filter(o => o.sampleStatus === 'completed').map(o => (
                                <div key={o._id} className="flex justify-between items-center p-4 border rounded-xl hover:bg-slate-50">
                                    <div>
                                        <h4 className="font-bold text-slate-800">{o.testName}</h4>
                                        <p className="text-xs text-slate-400">Date Completed: {new Date(o.verifiedAt || o.updatedAt).toLocaleDateString()} | Doctor: {o.doctorName}</p>
                                    </div>
                                    <a
                                        href={o.reportUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm px-4 py-2 rounded-xl flex items-center gap-2"
                                    >
                                        <FileDown size={16} /> Download PDF
                                    </a>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* Create Test Modal */}
            {showTestModal && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <form onSubmit={handleCreateTest} className="bg-white p-6 rounded-2xl border max-w-md w-full shadow-2xl space-y-4">
                        <h3 className="text-xl font-extrabold text-slate-800">Create LIS Test Catalog Entry</h3>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="col-span-2 space-y-1">
                                <label className="text-xs font-bold text-slate-500">Test Name</label>
                                <input
                                    type="text"
                                    required
                                    value={newTest.name}
                                    onChange={e => setNewTest({ ...newTest, name: e.target.value })}
                                    className="px-3 py-2 w-full border rounded-xl bg-white"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-500">Test Code</label>
                                <input
                                    type="text"
                                    required
                                    value={newTest.code}
                                    onChange={e => setNewTest({ ...newTest, code: e.target.value })}
                                    placeholder="e.g. CBC"
                                    className="px-3 py-2 w-full border rounded-xl bg-white"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-500">Price (INR)</label>
                                <input
                                    type="number"
                                    required
                                    value={newTest.price}
                                    onChange={e => setNewTest({ ...newTest, price: e.target.value })}
                                    className="px-3 py-2 w-full border rounded-xl bg-white"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-500">Sample Type</label>
                                <input
                                    type="text"
                                    required
                                    value={newTest.sampleType}
                                    onChange={e => setNewTest({ ...newTest, sampleType: e.target.value })}
                                    placeholder="e.g. Blood, Urine"
                                    className="px-3 py-2 w-full border rounded-xl bg-white"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-500">Category</label>
                                <select
                                    value={newTest.category}
                                    onChange={e => setNewTest({ ...newTest, category: e.target.value })}
                                    className="px-3 py-2 w-full border rounded-xl bg-white"
                                >
                                    <option value="Blood Work">Blood Work</option>
                                    <option value="Urinalysis">Urinalysis</option>
                                    <option value="Biochemistry">Biochemistry</option>
                                    <option value="Immunology">Immunology</option>
                                </select>
                            </div>
                            <div className="col-span-2 space-y-1">
                                <label className="text-xs font-bold text-slate-500">Parameters (comma-separated)</label>
                                <input
                                    type="text"
                                    required
                                    value={newTest.parameters}
                                    onChange={e => setNewTest({ ...newTest, parameters: e.target.value })}
                                    placeholder="e.g. Hemoglobin, RBC, WBC, Platelets"
                                    className="px-3 py-2 w-full border rounded-xl bg-white"
                                />
                            </div>
                        </div>
                        <div className="flex gap-2 justify-end pt-2">
                            <button
                                type="button"
                                onClick={() => setShowTestModal(false)}
                                className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold px-4 py-2 rounded-xl cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2 rounded-xl cursor-pointer"
                            >
                                Create
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}

