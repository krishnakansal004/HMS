import { useProfileRender } from '../utils/profiler';
import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import { CreditCard, Plus, Building2, CheckCircle, XCircle, DollarSign, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { CardSkeleton, TableSkeleton } from '../components/common/Skeleton';
import syncQueue from '../utils/syncQueue';

export default function Insurance() {
    useProfileRender('Insurance', true);
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState(user?.role === 'patient' ? 'my-claims' : 'claims');
    const [showCompanyModal, setShowCompanyModal] = useState(false);
    const [showClaimModal, setShowClaimModal] = useState(false);
    
    const [newCompany, setNewCompany] = useState({ name: '', code: '', contactPerson: '', email: '', phone: '', corporateDiscount: '' });
    const [newClaim, setNewClaim] = useState({ patientId: '', companyId: '', policyNumber: '', totalBillAmount: '', claimedAmount: '' });

    // Fetch Providers
    const { data: companiesData = [], isLoading: loadingCompanies } = useQuery({
        queryKey: ['insuranceCompanies'],
        queryFn: async () => {
            const res = await fetch('/api/insurance/companies', {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('hms.auth.token')}` }
            });
            if (!res.ok) throw new Error('Failed to load insurance providers');
            return res.json();
        }
    });

    // Fetch Claims
    const { data: claimsData = [], isLoading: loadingClaims } = useQuery({
        queryKey: ['insuranceClaims'],
        queryFn: async () => {
            const res = await fetch('/api/insurance/claims', {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('hms.auth.token')}` }
            });
            if (!res.ok) throw new Error('Failed to load claims');
            return res.json();
        }
    });

    // Fetch Patients
    const { data: patientsData = [] } = useQuery({
        queryKey: ['patients'],
        queryFn: async () => {
            const res = await fetch('/api/patients', {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('hms.auth.token')}` }
            });
            if (!res.ok) throw new Error('Failed to load patients');
            return res.json();
        },
        enabled: user?.role !== 'patient',
    });

    const companies = useMemo(() => Array.isArray(companiesData) ? companiesData : [], [companiesData]);
    const claims = useMemo(() => Array.isArray(claimsData) ? claimsData : [], [claimsData]);
    const patients = useMemo(() => Array.isArray(patientsData) ? patientsData : [], [patientsData]);

    const handleCreateCompany = async (e) => {
        e.preventDefault();
        
        const previousCompanies = queryClient.getQueryData(['insuranceCompanies']) || [];
        const tempId = `temp-company-${Date.now()}`;
        const optimisticCompany = {
            _id: tempId,
            ...newCompany,
            corporateDiscount: Number(newCompany.corporateDiscount || 0),
            _syncStatus: 'syncing',
        };

        queryClient.setQueryData(['insuranceCompanies'], (old = []) => [...old, optimisticCompany]);
        setShowCompanyModal(false);
        setNewCompany({ name: '', code: '', contactPerson: '', email: '', phone: '', corporateDiscount: '' });
        toast.success('Insurance provider registered (syncing in background)');

        syncQueue.enqueue({
            path: '/api/insurance/companies',
            method: 'POST',
            body: newCompany,
            tempId,
            queryKey: ['insuranceCompanies'],
            rollbackQueryKeys: [['insuranceCompanies']],
            previousData: [previousCompanies],
        }, queryClient, {
            onSuccess: (data) => {
                queryClient.setQueryData(['insuranceCompanies'], (old = []) =>
                    old.map(c => c._id === tempId ? { ...data, _syncStatus: 'synced' } : c)
                );
                setTimeout(() => {
                    queryClient.setQueryData(['insuranceCompanies'], (old = []) =>
                        old.map(c => c._id === (data._id || tempId) ? { ...c, _syncStatus: undefined } : c)
                    );
                }, 2000);
            },
            onError: (err) => {
                queryClient.setQueryData(['insuranceCompanies'], (old = []) =>
                    old.map(c => c._id === tempId
                        ? { ...c, _syncStatus: 'failed', _syncError: err.message }
                        : c
                    )
                );
            },
        });
    };

    const handleCreateClaim = async (e) => {
        e.preventDefault();

        const patient = patients.find(p => p._id === newClaim.patientId);
        const company = companies.find(c => c._id === newClaim.companyId);

        const previousClaims = queryClient.getQueryData(['insuranceClaims']) || [];
        const tempId = `temp-claim-${Date.now()}`;
        const optimisticClaim = {
            _id: tempId,
            patientId: newClaim.patientId,
            patientName: patient ? `${patient.firstName} ${patient.lastName || ''}`.trim() : 'Unknown Patient',
            companyId: newClaim.companyId,
            insuranceCompanyName: company ? company.name : 'Unknown Provider',
            policyNumber: newClaim.policyNumber,
            totalBillAmount: Number(newClaim.totalBillAmount),
            claimedAmount: Number(newClaim.claimedAmount),
            approvedAmount: 0,
            status: 'submitted',
            _syncStatus: 'syncing',
        };

        queryClient.setQueryData(['insuranceClaims'], (old = []) => [optimisticClaim, ...old]);
        setShowClaimModal(false);
        setNewClaim({ patientId: '', companyId: '', policyNumber: '', totalBillAmount: '', claimedAmount: '' });
        toast.success('Insurance claim request logged (syncing in background)');

        syncQueue.enqueue({
            path: '/api/insurance/claims',
            method: 'POST',
            body: newClaim,
            tempId,
            queryKey: ['insuranceClaims'],
            rollbackQueryKeys: [['insuranceClaims']],
            previousData: [previousClaims],
        }, queryClient, {
            onSuccess: (data) => {
                queryClient.setQueryData(['insuranceClaims'], (old = []) =>
                    old.map(c => c._id === tempId ? { ...data, _syncStatus: 'synced' } : c)
                );
                setTimeout(() => {
                    queryClient.setQueryData(['insuranceClaims'], (old = []) =>
                        old.map(c => c._id === (data._id || tempId) ? { ...c, _syncStatus: undefined } : c)
                    );
                }, 2000);
            },
            onError: (err) => {
                queryClient.setQueryData(['insuranceClaims'], (old = []) =>
                    old.map(c => c._id === tempId
                        ? { ...c, _syncStatus: 'failed', _syncError: err.message }
                        : c
                    )
                );
            },
        });
    };

    const handleUpdateClaimStatus = (claimId, status, approvedAmount) => {
        const previousClaims = queryClient.getQueryData(['insuranceClaims']) || [];
        
        const optimisticClaims = previousClaims.map(c => c._id === claimId 
            ? { 
                ...c, 
                status, 
                approvedAmount, 
                settlementDate: status === 'settled' ? new Date().toISOString() : null, 
                transactionId: status === 'settled' ? 'TXN-INS-' + Date.now().toString().slice(-6) : null,
                _syncStatus: 'syncing',
            }
            : c
        );
        queryClient.setQueryData(['insuranceClaims'], optimisticClaims);
        toast.success(`Claim status updated to ${status} (syncing in background)`);

        syncQueue.enqueue({
            path: `/api/insurance/claims/${claimId}`,
            method: 'PUT',
            body: {
                status,
                approvedAmount,
                settlementDate: status === 'settled' ? new Date() : null,
                transactionId: status === 'settled' ? 'TXN-INS-' + Date.now().toString().slice(-6) : null
            },
            rollbackQueryKeys: [['insuranceClaims']],
            previousData: [previousClaims],
        }, queryClient, {
            onSuccess: () => {
                queryClient.setQueryData(['insuranceClaims'], (old = []) =>
                    old.map(c => c._id === claimId ? { ...c, _syncStatus: undefined } : c)
                );
            },
            onError: () => {
                queryClient.setQueryData(['insuranceClaims'], previousClaims);
                toast.error('Failed to update claim status. Reverted.');
            },
        });
    };

    return (
        <div className="p-6 space-y-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-gray-950 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                <div>
                    <h1 className="text-3xl font-extrabold text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-3">
                        <CreditCard className="text-indigo-600 dark:text-indigo-400" size={32} />
                        Insurance & TPA Claims Desk
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 font-medium mt-1">Manage cashless corporate accounts, log patient policies, and track settlement claims.</p>
                </div>
                {user?.role !== 'patient' && (
                    <div className="flex gap-2">
                        <button
                            onClick={() => setShowCompanyModal(true)}
                            className="bg-slate-850 hover:bg-slate-900 dark:bg-slate-800 dark:hover:bg-slate-700 text-white font-semibold px-4 py-2.5 rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer"
                        >
                            <Building2 size={18} />
                            Add TPA Provider
                        </button>
                        <button
                            onClick={() => setShowClaimModal(true)}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 py-2.5 rounded-xl transition-all shadow-lg hover:scale-[1.02] flex items-center gap-2 cursor-pointer"
                        >
                            <Plus size={18} />
                            Log Patient Claim
                        </button>
                    </div>
                )}
            </div>

            {/* Navigation Tabs */}
            <div className="flex gap-2 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl w-fit">
                {user?.role !== 'patient' && (
                    <>
                        <button
                            onClick={() => setActiveTab('claims')}
                            className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all cursor-pointer ${activeTab === 'claims' ? 'bg-white dark:bg-gray-800 text-slate-800 dark:text-white shadow-sm' : 'text-slate-650 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'}`}
                        >
                            Claims Settlement Dashboard
                        </button>
                        <button
                            onClick={() => setActiveTab('companies')}
                            className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all cursor-pointer ${activeTab === 'companies' ? 'bg-white dark:bg-gray-800 text-slate-800 dark:text-white shadow-sm' : 'text-slate-650 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'}`}
                        >
                            TPA Providers Registry
                        </button>
                    </>
                )}
                {user?.role === 'patient' && (
                    <button
                        onClick={() => setActiveTab('my-claims')}
                        className="bg-white dark:bg-gray-800 text-slate-800 dark:text-white px-4 py-2 rounded-lg font-semibold text-sm shadow-sm"
                    >
                        My Insurance Claims
                    </button>
                )}
            </div>

            {/* Claims Tab Content */}
            {activeTab === 'claims' && (
                <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        {loadingClaims ? (
                            <div className="p-6"><TableSkeleton rows={4} cols={6} /></div>
                        ) : (
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/50 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                        <th className="p-4">Patient details</th>
                                        <th className="p-4">TPA / Policy</th>
                                        <th className="p-4">Claimed (INR)</th>
                                        <th className="p-4">Approved (INR)</th>
                                        <th className="p-4">Status</th>
                                        <th className="p-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm text-slate-700 dark:text-slate-300">
                                    {claims.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="p-8 text-center text-slate-400">No active insurance claims logged.</td>
                                        </tr>
                                    ) : (
                                        claims.map(c => (
                                            <tr key={c._id} className="hover:bg-slate-50/30 dark:hover:bg-gray-850/50 transition-all">
                                                <td className="p-4 font-bold text-slate-800 dark:text-slate-100">{c.patientName}</td>
                                                <td className="p-4">
                                                    <span className="font-semibold">{c.insuranceCompanyName}</span>
                                                    <span className="block text-xs text-slate-400 font-medium mt-0.5">Policy: {c.policyNumber}</span>
                                                </td>
                                                <td className="p-4 font-semibold text-slate-600 dark:text-slate-400">₹{c.claimedAmount}</td>
                                                <td className="p-4 font-bold text-slate-800 dark:text-slate-200">
                                                    {c.status === 'submitted' ? (
                                                        <span className="text-slate-400 text-xs italic">Awaiting Approval</span>
                                                    ) : (
                                                        `₹${c.approvedAmount}`
                                                    )}
                                                </td>
                                                <td className="p-4">
                                                    <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full uppercase ${c.status === 'settled' || c.status === 'approved' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400' : c.status === 'rejected' ? 'bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-400' : 'bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400'}`}>
                                                        {c.status}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-right flex justify-end gap-2">
                                                    {c.status === 'submitted' && (
                                                        <>
                                                            <button
                                                                onClick={() => {
                                                                    const amt = prompt('Enter approved amount:');
                                                                    if (amt !== null && amt !== '') handleUpdateClaimStatus(c._id, 'approved', Number(amt));
                                                                }}
                                                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer transition-all"
                                                            >
                                                                <CheckCircle size={12} /> Approve
                                                            </button>
                                                            <button
                                                                onClick={() => handleUpdateClaimStatus(c._id, 'rejected', 0)}
                                                                className="bg-red-55 hover:bg-red-100 hover:text-red-800 text-red-700 font-bold text-xs px-3 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer transition-all"
                                                            >
                                                                <XCircle size={12} /> Reject
                                                            </button>
                                                        </>
                                                    )}
                                                    {c.status === 'approved' && (
                                                        <button
                                                            onClick={() => handleUpdateClaimStatus(c._id, 'settled', c.approvedAmount)}
                                                            className="bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs px-3 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer transition-all"
                                                        >
                                                            <DollarSign size={12} /> Mark Settled
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            )}

            {/* Providers Registry Tab Content */}
            {activeTab === 'companies' && (
                <div>
                    {loadingCompanies ? (
                        <CardSkeleton count={3} cols={3} />
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {companies.map(c => (
                                <div key={c._id} className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm space-y-3">
                                    <div className="flex justify-between items-start">
                                        <span className="text-xs bg-indigo-50 dark:bg-indigo-950/35 text-indigo-700 dark:text-indigo-300 font-bold px-2.5 py-0.5 rounded-md">{c.code}</span>
                                        <span className="text-xs font-bold text-emerald-600 dark:text-emerald-455">Corp Discount: {c.corporateDiscount}%</span>
                                    </div>
                                    <div>
                                        <h3 className="font-extrabold text-slate-800 dark:text-slate-100 text-lg">{c.name}</h3>
                                        <p className="text-slate-500 dark:text-slate-400 font-semibold text-xs mt-1">Spoc: {c.contactPerson}</p>
                                        <p className="text-slate-400 dark:text-slate-500 text-xs mt-0.5">Email: {c.email} | Phone: {c.phone}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Patient Claims View */}
            {activeTab === 'my-claims' && (
                <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border dark:border-slate-800 shadow-sm space-y-4">
                    <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">My Insurance Claims Status</h2>
                    <div className="space-y-3">
                        {claims.length === 0 ? (
                            <p className="text-slate-500 dark:text-slate-400 text-center py-6">No claims logged for your profile.</p>
                        ) : (
                            claims.map(c => (
                                <div key={c._id} className="flex justify-between items-center p-4 border dark:border-slate-800 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-850">
                                    <div>
                                        <h4 className="font-bold text-slate-800 dark:text-slate-200">{c.insuranceCompanyName}</h4>
                                        <p className="text-xs text-slate-400 dark:text-slate-500">Policy Number: {c.policyNumber} | Total Claimed: ₹{c.claimedAmount}</p>
                                        {c.status === 'settled' && (
                                            <p className="text-xs text-emerald-600 dark:text-emerald-400 font-bold mt-1">Payout Settled: ₹{c.approvedAmount} (Txn: {c.transactionId})</p>
                                        )}
                                    </div>
                                    <span className={`text-xs font-bold px-3 py-1 rounded-full uppercase ${c.status === 'settled' || c.status === 'approved' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400' : c.status === 'rejected' ? 'bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-400' : 'bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400'}`}>
                                        {c.status}
                                    </span>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* Add Company Modal */}
            <AnimatePresence>
                {showCompanyModal && (
                    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white dark:bg-gray-900 p-6 rounded-2xl border dark:border-slate-800 max-w-md w-full shadow-2xl space-y-4">
                            <div className="flex justify-between items-center">
                                <h3 className="text-xl font-extrabold text-slate-800 dark:text-slate-100">Register TPA Provider</h3>
                                <button onClick={() => setShowCompanyModal(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"><X size={20} className="text-slate-500" /></button>
                            </div>
                            <form onSubmit={handleCreateCompany} className="space-y-4">
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="col-span-2 space-y-1">
                                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400">Provider Name</label>
                                        <input
                                            type="text"
                                            required
                                            value={newCompany.name}
                                            onChange={e => setNewCompany({ ...newCompany, name: e.target.value })}
                                            placeholder="e.g. Star Health Insurance"
                                            className="input"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400">TPA Code</label>
                                        <input
                                            type="text"
                                            required
                                            value={newCompany.code}
                                            onChange={e => setNewCompany({ ...newCompany, code: e.target.value })}
                                            placeholder="e.g. STAR-TPA"
                                            className="input"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400">Corp Discount (%)</label>
                                        <input
                                            type="number"
                                            required
                                            value={newCompany.corporateDiscount}
                                            onChange={e => setNewCompany({ ...newCompany, corporateDiscount: e.target.value })}
                                            className="input"
                                        />
                                    </div>
                                    <div className="col-span-2 space-y-1">
                                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400">SPOC Person Name</label>
                                        <input
                                            type="text"
                                            required
                                            value={newCompany.contactPerson}
                                            onChange={e => setNewCompany({ ...newCompany, contactPerson: e.target.value })}
                                            className="input"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400">SPOC Phone</label>
                                        <input
                                            type="text"
                                            required
                                            value={newCompany.phone}
                                            onChange={e => setNewCompany({ ...newCompany, phone: e.target.value })}
                                            className="input"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400">SPOC Email</label>
                                        <input
                                            type="email"
                                            required
                                            value={newCompany.email}
                                            onChange={e => setNewCompany({ ...newCompany, email: e.target.value })}
                                            className="input"
                                        />
                                    </div>
                                </div>
                                <div className="flex gap-2 justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
                                    <button
                                        type="button"
                                        onClick={() => setShowCompanyModal(false)}
                                        className="btn btn-ghost"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="btn btn-primary"
                                    >
                                        Register Company
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Log Claim Modal */}
            <AnimatePresence>
                {showClaimModal && (
                    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white dark:bg-gray-900 p-6 rounded-2xl border dark:border-slate-800 max-w-md w-full shadow-2xl space-y-4">
                            <div className="flex justify-between items-center">
                                <h3 className="text-xl font-extrabold text-slate-800 dark:text-slate-100">Log Cashless Claim Request</h3>
                                <button onClick={() => setShowClaimModal(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"><X size={20} className="text-slate-500" /></button>
                            </div>
                            <form onSubmit={handleCreateClaim} className="space-y-4">
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="col-span-2 space-y-1">
                                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400">Select Patient</label>
                                        <select
                                            required
                                            value={newClaim.patientId}
                                            onChange={e => setNewClaim({ ...newClaim, patientId: e.target.value })}
                                            className="input font-semibold"
                                        >
                                            <option value="">-- Choose Patient --</option>
                                            {patients.map(p => (
                                                <option key={p._id} value={p._id}>{p.firstName} {p.lastName} ({p.phone})</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="col-span-2 space-y-1">
                                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400">Select TPA / Provider</label>
                                        <select
                                            required
                                            value={newClaim.companyId}
                                            onChange={e => setNewClaim({ ...newClaim, companyId: e.target.value })}
                                            className="input font-semibold"
                                        >
                                            <option value="">-- Choose Provider --</option>
                                            {companies.map(c => (
                                                <option key={c._id} value={c._id}>{c.name} ({c.code})</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="col-span-2 space-y-1">
                                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400">Policy Card Number</label>
                                        <input
                                            type="text"
                                            required
                                            value={newClaim.policyNumber}
                                            onChange={e => setNewClaim({ ...newClaim, policyNumber: e.target.value })}
                                            placeholder="e.g. POL-8749-23"
                                            className="input"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400">Total Bill (INR)</label>
                                        <input
                                            type="number"
                                            required
                                            value={newClaim.totalBillAmount}
                                            onChange={e => setNewClaim({ ...newClaim, totalBillAmount: e.target.value })}
                                            className="input"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400">Claimed Amount (INR)</label>
                                        <input
                                            type="number"
                                            required
                                            value={newClaim.claimedAmount}
                                            onChange={e => setNewClaim({ ...newClaim, claimedAmount: e.target.value })}
                                            className="input"
                                        />
                                    </div>
                                </div>
                                <div className="flex gap-2 justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
                                    <button
                                        type="button"
                                        onClick={() => setShowClaimModal(false)}
                                        className="btn btn-ghost"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="btn btn-primary"
                                    >
                                        Log Claim Request
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
