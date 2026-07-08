import { useProfileRender } from '../utils/profiler';
import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import { Users, DollarSign, Award, Star, Search, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { CardSkeleton, TableSkeleton } from '../components/common/Skeleton';
import syncQueue from '../utils/syncQueue';

export default function HRMS() {
    useProfileRender('HRMS', true);
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState('payroll');
    const [search, setSearch] = useState('');

    const [showPayrollModal, setShowPayrollModal] = useState(false);
    const [showReviewModal, setShowReviewModal] = useState(false);
    
    const [selectedEmployee, setSelectedEmployee] = useState(null);
    const [newPayroll, setNewPayroll] = useState({ month: 'June', year: '2026', baseSalary: '', bonuses: '', deductions: '', notes: '' });
    const [newReview, setNewReview] = useState({ rating: '5', feedback: '', punctuality: '5', careQuality: '5', teamCooperation: '5' });

    // Queries
    const { data: staff = [], isLoading: loadingStaff } = useQuery({
        queryKey: ['hrmsStaff'],
        queryFn: async () => {
            const res = await fetch('/api/staff', {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('hms.auth.token')}` }
            });
            if (!res.ok) throw new Error('Failed to load staff list');
            return res.json();
        }
    });

    const { data: payrolls = [], isLoading: loadingPayroll } = useQuery({
        queryKey: ['hrmsPayroll'],
        queryFn: async () => {
            const res = await fetch('/api/hrms/payroll', {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('hms.auth.token')}` }
            });
            if (!res.ok) throw new Error('Failed to load payroll details');
            return res.json();
        }
    });

    const { data: reviews = [], isLoading: loadingReviews } = useQuery({
        queryKey: ['hrmsPerformance'],
        queryFn: async () => {
            const res = await fetch('/api/hrms/performance', {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('hms.auth.token')}` }
            });
            if (!res.ok) throw new Error('Failed to load reviews');
            return res.json();
        }
    });

    const handleReleasePayroll = (e) => {
        e.preventDefault();

        const previousPayroll = queryClient.getQueryData(['hrmsPayroll']) || [];
        const base = Number(newPayroll.baseSalary || 0);
        const bonus = Number(newPayroll.bonuses || 0);
        const deduction = Number(newPayroll.deductions || 0);
        const tempId = `temp-payroll-${Date.now()}`;
        const optimisticPayroll = {
            _id: tempId,
            staffId: selectedEmployee._id,
            staffName: selectedEmployee.name,
            staffRole: selectedEmployee.role,
            payPeriodMonth: newPayroll.month,
            payPeriodYear: newPayroll.year,
            baseSalary: base,
            bonuses: bonus,
            deductions: deduction,
            netSalary: base + bonus - deduction,
            payoutDate: new Date().toISOString(),
            transactionId: 'TXN-PAY-' + Date.now().toString().slice(-6),
            notes: newPayroll.notes,
            _syncStatus: 'syncing',
        };
        queryClient.setQueryData(['hrmsPayroll'], (old = []) => [optimisticPayroll, ...old]);
        setShowPayrollModal(false);
        setSelectedEmployee(null);
        setNewPayroll({ month: 'June', year: '2026', baseSalary: '', bonuses: '', deductions: '', notes: '' });
        toast.success(`Payroll released for ${selectedEmployee.name} (syncing)`);
        syncQueue.enqueue({
            path: '/api/hrms/payroll',
            method: 'POST',
            body: { ...newPayroll, staffId: selectedEmployee._id },
            tempId,
            queryKey: ['hrmsPayroll'],
            rollbackQueryKeys: [['hrmsPayroll']],
            previousData: [previousPayroll],
        }, queryClient, {
            onSuccess: (data) => {
                queryClient.setQueryData(['hrmsPayroll'], (old = []) =>
                    old.map(p => p._id === tempId ? { ...data, _syncStatus: 'synced' } : p)
                );
                setTimeout(() => queryClient.setQueryData(['hrmsPayroll'], (old = []) =>
                    old.map(p => p._id === (data._id || tempId) ? { ...p, _syncStatus: undefined } : p)
                ), 2000);
            },
            onError: (err) => {
                queryClient.setQueryData(['hrmsPayroll'], (old = []) =>
                    old.map(p => p._id === tempId ? { ...p, _syncStatus: 'failed', _syncError: err.message } : p)
                );
            },
        });
    };

    const handleCreateReview = (e) => {
        e.preventDefault();

        const previousReviews = queryClient.getQueryData(['hrmsPerformance']) || [];
        const tempId = `temp-review-${Date.now()}`;
        const optimisticReview = {
            _id: tempId,
            staffId: selectedEmployee._id,
            staffName: selectedEmployee.name,
            rating: Number(newReview.rating),
            feedback: newReview.feedback,
            metrics: {
                punctuality: Number(newReview.punctuality),
                careQuality: Number(newReview.careQuality),
                teamCooperation: Number(newReview.teamCooperation)
            },
            createdAt: new Date().toISOString(),
            _syncStatus: 'syncing',
        };
        queryClient.setQueryData(['hrmsPerformance'], (old = []) => [optimisticReview, ...old]);
        setShowReviewModal(false);
        setSelectedEmployee(null);
        setNewReview({ rating: '5', feedback: '', punctuality: '5', careQuality: '5', teamCooperation: '5' });
        toast.success(`Performance evaluation scorecard updated (syncing)`);
        syncQueue.enqueue({
            path: '/api/hrms/performance',
            method: 'POST',
            body: {
                staffId: selectedEmployee._id,
                rating: Number(newReview.rating),
                feedback: newReview.feedback,
                metrics: {
                    punctuality: Number(newReview.punctuality),
                    careQuality: Number(newReview.careQuality),
                    teamCooperation: Number(newReview.teamCooperation)
                }
            },
            tempId,
            queryKey: ['hrmsPerformance'],
            rollbackQueryKeys: [['hrmsPerformance']],
            previousData: [previousReviews],
        }, queryClient, {
            onSuccess: (data) => {
                queryClient.setQueryData(['hrmsPerformance'], (old = []) =>
                    old.map(r => r._id === tempId ? { ...data, _syncStatus: 'synced' } : r)
                );
                setTimeout(() => queryClient.setQueryData(['hrmsPerformance'], (old = []) =>
                    old.map(r => r._id === (data._id || tempId) ? { ...r, _syncStatus: undefined } : r)
                ), 2000);
            },
            onError: (err) => {
                queryClient.setQueryData(['hrmsPerformance'], (old = []) =>
                    old.map(r => r._id === tempId ? { ...r, _syncStatus: 'failed', _syncError: err.message } : r)
                );
            },
        });
    };

    const openPayrollModal = (employee) => {
        setSelectedEmployee(employee);
        setNewPayroll({ ...newPayroll, baseSalary: employee.experienceYears > 5 ? 50000 : 35000 });
        setShowPayrollModal(true);
    };

    const openReviewModal = (employee) => {
        setSelectedEmployee(employee);
        setShowReviewModal(true);
    };

    const filteredStaff = useMemo(() => {
        return staff.filter(s =>
            s.name?.toLowerCase().includes(search.toLowerCase()) ||
            s.role?.toLowerCase().includes(search.toLowerCase()) ||
            s.department?.toLowerCase().includes(search.toLowerCase())
        );
    }, [staff, search]);

    return (
        <div className="p-6 space-y-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-gray-950 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                <div>
                    <h1 className="text-3xl font-extrabold text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-3">
                        <Users className="text-indigo-600 dark:text-indigo-400" size={32} />
                        Human Resource Management (HRMS)
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 font-medium mt-1">Manage payroll distributions, employee leaves, and submit performance evaluations.</p>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex gap-2 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl w-fit">
                <button
                    onClick={() => setActiveTab('payroll')}
                    className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all cursor-pointer ${activeTab === 'payroll' ? 'bg-white dark:bg-gray-800 text-slate-800 dark:text-white shadow-sm' : 'text-slate-650 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'}`}
                >
                    Payroll Center
                </button>
                <button
                    onClick={() => setActiveTab('history')}
                    className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all cursor-pointer ${activeTab === 'history' ? 'bg-white dark:bg-gray-800 text-slate-800 dark:text-white shadow-sm' : 'text-slate-650 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'}`}
                >
                    Payout Logs
                </button>
                <button
                    onClick={() => setActiveTab('reviews')}
                    className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all cursor-pointer ${activeTab === 'reviews' ? 'bg-white dark:bg-gray-800 text-slate-800 dark:text-white shadow-sm' : 'text-slate-655 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'}`}
                >
                    Performance Reviews
                </button>
            </div>

            {/* Tab: Payroll Center */}
            {activeTab === 'payroll' && (
                <div className="space-y-4">
                    <div className="relative max-w-md">
                        <Search className="absolute left-3 top-3.5 text-slate-400" size={18} />
                        <input
                            type="text"
                            placeholder="Filter staff by name or role..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="pl-10 pr-4 py-2.5 w-full bg-white dark:bg-gray-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none text-slate-700 dark:text-slate-300 shadow-sm"
                        />
                    </div>

                    {loadingStaff ? (
                        <CardSkeleton count={3} cols={3} />
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {filteredStaff.map(s => (
                                <div key={s._id} className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm space-y-4 hover:border-indigo-100 dark:hover:border-indigo-900 transition-all flex flex-col justify-between">
                                    <div>
                                        <div className="flex justify-between items-start">
                                            <span className="text-xs bg-indigo-50 dark:bg-indigo-950/35 text-indigo-700 dark:text-indigo-300 font-extrabold px-2.5 py-0.5 rounded-md uppercase">{s.role}</span>
                                            <span className="text-xs text-slate-400 dark:text-slate-500 font-semibold">{s.department || 'General'}</span>
                                        </div>
                                        <h3 className="font-extrabold text-slate-800 dark:text-slate-100 text-lg mt-2">{s.name}</h3>
                                        <p className="text-slate-400 dark:text-slate-500 text-xs mt-0.5">Experience: {s.experienceYears || 1} Year(s)</p>
                                    </div>

                                    <div className="flex gap-2 pt-4 border-t dark:border-slate-800">
                                        <button
                                            onClick={() => openPayrollModal(s)}
                                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-2 px-3 rounded-lg w-full flex items-center justify-center gap-1 cursor-pointer transition-all"
                                        >
                                            <DollarSign size={12} /> Release Salary
                                        </button>
                                        <button
                                            onClick={() => openReviewModal(s)}
                                            className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-white font-bold text-xs py-2 px-3 rounded-lg w-full flex items-center justify-center gap-1 cursor-pointer transition-all"
                                        >
                                            <Award size={12} /> Rate Review
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Tab: Payout Logs */}
            {activeTab === 'history' && (
                <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        {loadingPayroll ? (
                            <div className="p-6"><TableSkeleton rows={4} cols={6} /></div>
                        ) : (
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/50 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                        <th className="p-4">Employee</th>
                                        <th className="p-4">Role</th>
                                        <th className="p-4">Pay Period</th>
                                        <th className="p-4">Net Paid (INR)</th>
                                        <th className="p-4">Payout Date</th>
                                        <th className="p-4">Transaction ID</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm text-slate-700 dark:text-slate-300">
                                    {payrolls.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="p-8 text-center text-slate-400">No payout records found.</td>
                                        </tr>
                                    ) : (
                                        payrolls.map(p => (
                                            <tr key={p._id} className="hover:bg-slate-50/30 dark:hover:bg-gray-850/50 transition-all">
                                                <td className="p-4 font-bold text-slate-800 dark:text-slate-100">{p.staffName}</td>
                                                <td className="p-4 uppercase text-xs font-bold text-slate-555 dark:text-slate-405">{p.staffRole}</td>
                                                <td className="p-4 font-semibold">{p.payPeriodMonth} {p.payPeriodYear}</td>
                                                <td className="p-4 font-extrabold text-emerald-600 dark:text-emerald-400">₹{p.netSalary}</td>
                                                <td className="p-4 font-medium text-slate-400 dark:text-slate-500">{new Date(p.payoutDate).toLocaleDateString()}</td>
                                                <td className="p-4 font-mono text-xs text-slate-400 dark:text-slate-500">{p.transactionId}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            )}

            {/* Tab: Reviews */}
            {activeTab === 'reviews' && (
                <div>
                    {loadingReviews ? (
                        <CardSkeleton count={3} cols={3} />
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {reviews.map(r => (
                                <div key={r._id} className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
                                    <div className="flex justify-between items-start border-b dark:border-slate-800 pb-2">
                                        <div>
                                            <h3 className="font-extrabold text-slate-800 dark:text-slate-100 text-lg">{r.staffName}</h3>
                                            <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">Review Date: {new Date(r.createdAt).toLocaleDateString()}</span>
                                        </div>
                                        <div className="flex items-center gap-1 bg-amber-50 dark:bg-amber-955/20 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-md text-xs font-bold">
                                            <Star size={12} className="fill-amber-600 dark:fill-amber-400" />
                                            {r.rating} / 5
                                        </div>
                                    </div>
                                    <p className="text-slate-600 dark:text-slate-300 text-sm italic">"{r.feedback}"</p>
                                    
                                    {r.metrics && (
                                        <div className="grid grid-cols-3 gap-2 text-center text-[10px] font-bold text-slate-500 dark:text-slate-400 font-mono">
                                            <div className="bg-slate-50 dark:bg-slate-800 p-2 rounded-lg">
                                                Punctual
                                                <span className="block text-slate-800 dark:text-slate-200 font-bold mt-0.5">{r.metrics.punctuality}/5</span>
                                            </div>
                                            <div className="bg-slate-50 dark:bg-slate-800 p-2 rounded-lg">
                                                Clinical Care
                                                <span className="block text-slate-800 dark:text-slate-200 font-bold mt-0.5">{r.metrics.careQuality}/5</span>
                                            </div>
                                            <div className="bg-slate-50 dark:bg-slate-800 p-2 rounded-lg">
                                                Teamwork
                                                <span className="block text-slate-800 dark:text-slate-200 font-bold mt-0.5">{r.metrics.teamCooperation}/5</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Release Payroll Modal */}
            <AnimatePresence>
                {showPayrollModal && selectedEmployee && (
                    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white dark:bg-gray-900 p-6 rounded-2xl border dark:border-slate-800 max-w-md w-full shadow-2xl space-y-4">
                            <div className="flex justify-between items-center">
                                <h3 className="text-xl font-extrabold text-slate-800 dark:text-slate-100">Generate Salary Payout Sheet</h3>
                                <button onClick={() => { setShowPayrollModal(false); setSelectedEmployee(null); }} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"><X size={20} className="text-slate-500" /></button>
                            </div>
                            <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">Staff: {selectedEmployee.name} | Role: {selectedEmployee.role}</p>
                            
                            <form onSubmit={handleReleasePayroll} className="space-y-4">
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400">Month</label>
                                        <select
                                            value={newPayroll.month}
                                            onChange={e => setNewPayroll({ ...newPayroll, month: e.target.value })}
                                            className="input font-semibold"
                                        >
                                            <option value="January">January</option>
                                            <option value="February">February</option>
                                            <option value="March">March</option>
                                            <option value="April">April</option>
                                            <option value="May">May</option>
                                            <option value="June">June</option>
                                            <option value="July">July</option>
                                            <option value="August">August</option>
                                            <option value="September">September</option>
                                            <option value="October">October</option>
                                            <option value="November">November</option>
                                            <option value="December">December</option>
                                        </select>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400">Year</label>
                                        <input
                                            type="number"
                                            required
                                            value={newPayroll.year}
                                            onChange={e => setNewPayroll({ ...newPayroll, year: e.target.value })}
                                            className="input"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400">Base Salary (INR)</label>
                                        <input
                                            type="number"
                                            required
                                            value={newPayroll.baseSalary}
                                            onChange={e => setNewPayroll({ ...newPayroll, baseSalary: e.target.value })}
                                            className="input"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400">Bonuses (INR)</label>
                                        <input
                                            type="number"
                                            value={newPayroll.bonuses}
                                            onChange={e => setNewPayroll({ ...newPayroll, bonuses: e.target.value })}
                                            placeholder="0"
                                            className="input"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400">Deductions (INR)</label>
                                        <input
                                            type="number"
                                            value={newPayroll.deductions}
                                            onChange={e => setNewPayroll({ ...newPayroll, deductions: e.target.value })}
                                            placeholder="0"
                                            className="input"
                                        />
                                    </div>
                                    <div className="col-span-2 space-y-1">
                                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400">Deduction Notes / Details</label>
                                        <input
                                            type="text"
                                            value={newPayroll.notes}
                                            onChange={e => setNewPayroll({ ...newPayroll, notes: e.target.value })}
                                            placeholder="e.g. Leave deductions"
                                            className="input text-sm"
                                        />
                                    </div>
                                </div>
                                <div className="flex gap-2 justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
                                    <button
                                        type="button"
                                        onClick={() => { setShowPayrollModal(false); setSelectedEmployee(null); }}
                                        className="btn btn-ghost"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="btn btn-primary"
                                    >
                                        Release Salary Payout
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Performance Review Modal */}
            <AnimatePresence>
                {showReviewModal && selectedEmployee && (
                    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white dark:bg-gray-900 p-6 rounded-2xl border dark:border-slate-800 max-w-md w-full shadow-2xl space-y-4">
                            <div className="flex justify-between items-center">
                                <h3 className="text-xl font-extrabold text-slate-800 dark:text-slate-100">Add Staff Performance Card</h3>
                                <button onClick={() => { setShowReviewModal(false); setSelectedEmployee(null); }} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"><X size={20} className="text-slate-500" /></button>
                            </div>
                            <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">Staff: {selectedEmployee.name} | Role: {selectedEmployee.role}</p>

                            <form onSubmit={handleCreateReview} className="space-y-4">
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400">Overall Rating</label>
                                        <select
                                            value={newReview.rating}
                                            onChange={e => setNewReview({ ...newReview, rating: e.target.value })}
                                            className="input font-bold text-amber-600 dark:text-amber-400"
                                        >
                                            <option value="5">5 - Excellent</option>
                                            <option value="4">4 - Good</option>
                                            <option value="3">3 - Average</option>
                                            <option value="2">2 - Poor</option>
                                            <option value="1">1 - Critical</option>
                                        </select>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400">Punctuality</label>
                                        <select
                                            value={newReview.punctuality}
                                            onChange={e => setNewReview({ ...newReview, punctuality: e.target.value })}
                                            className="input font-semibold"
                                        >
                                            <option value="5">5</option><option value="4">4</option><option value="3">3</option><option value="2">2</option><option value="1">1</option>
                                        </select>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400">Care Quality</label>
                                        <select
                                            value={newReview.careQuality}
                                            onChange={e => setNewReview({ ...newReview, careQuality: e.target.value })}
                                            className="input font-semibold"
                                        >
                                            <option value="5">5</option><option value="4">4</option><option value="3">3</option><option value="2">2</option><option value="1">1</option>
                                        </select>
                                    </div>
                                    <div className="space-y-1 col-span-3">
                                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400">Team Cooperation</label>
                                        <select
                                            value={newReview.teamCooperation}
                                            onChange={e => setNewReview({ ...newReview, teamCooperation: e.target.value })}
                                            className="input font-semibold"
                                        >
                                            <option value="5">5</option><option value="4">4</option><option value="3">3</option><option value="2">2</option><option value="1">1</option>
                                        </select>
                                    </div>
                                    <div className="col-span-3 space-y-1">
                                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400">Clinical Feedback Comments</label>
                                        <textarea
                                            required
                                            rows="3"
                                            value={newReview.feedback}
                                            onChange={e => setNewReview({ ...newReview, feedback: e.target.value })}
                                            placeholder="Enter performance summary review comments..."
                                            className="input text-sm"
                                        />
                                    </div>
                                </div>

                                <div className="flex gap-2 justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
                                    <button
                                        type="button"
                                        onClick={() => { setShowReviewModal(false); setSelectedEmployee(null); }}
                                        className="btn btn-ghost"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="btn btn-primary"
                                    >
                                        Submit Scorecard
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
