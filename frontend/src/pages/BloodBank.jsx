import { useProfileRender } from '../utils/profiler';
import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import { Search, Plus, Heart, HeartCrack, Layers, ShieldCheck, UserCheck, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { CardSkeleton, TableSkeleton } from '../components/common/Skeleton';
import syncQueue from '../utils/syncQueue';

export default function BloodBank() {
    useProfileRender('BloodBank', true);
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState('inventory');
    
    const [showDonorModal, setShowDonorModal] = useState(false);
    const [showBagModal, setShowBagModal] = useState(false);
    const [showRequestModal, setShowRequestModal] = useState(false);

    const [newDonor, setNewDonor] = useState({ name: '', bloodGroup: 'A+', age: '', gender: 'M', phone: '', email: '', pulse: '', bloodPressure: '', weight: '' });
    const [newBag, setNewBag] = useState({ bagNumber: '', bloodGroup: 'A+', volumeMl: '350', donorId: '' });
    const [newRequest, setNewRequest] = useState({ patientId: '', bloodGroup: 'A+', unitsRequested: '', urgency: 'routine' });

    // Queries
    const { data: donors = [], isLoading: loadingDonors } = useQuery({
        queryKey: ['bloodDonors'],
        queryFn: async () => {
            const res = await fetch('/api/bloodbank/donors', {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('hms.auth.token')}` }
            });
            if (!res.ok) throw new Error('Failed to load donors list');
            return res.json();
        }
    });

    const { data: inventory = [], isLoading: loadingInventory } = useQuery({
        queryKey: ['bloodInventory'],
        queryFn: async () => {
            const res = await fetch('/api/bloodbank/inventory', {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('hms.auth.token')}` }
            });
            if (!res.ok) throw new Error('Failed to load blood inventory');
            return res.json();
        }
    });

    const { data: requests = [], isLoading: loadingRequests } = useQuery({
        queryKey: ['bloodRequests'],
        queryFn: async () => {
            const res = await fetch('/api/bloodbank/requests', {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('hms.auth.token')}` }
            });
            if (!res.ok) throw new Error('Failed to load blood requests');
            return res.json();
        }
    });

    const { data: patients = [] } = useQuery({
        queryKey: ['patients'],
        queryFn: async () => {
            const res = await fetch('/api/patients', {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('hms.auth.token')}` }
            });
            if (!res.ok) throw new Error('Failed to load patients');
            return res.json();
        },
        enabled: user?.role !== 'patient'
    });

    const handleRegisterDonor = (e) => {
        e.preventDefault();
        const previousDonors = queryClient.getQueryData(['bloodDonors']) || [];
        const tempId = `temp-donor-${Date.now()}`;
        const optimisticDonor = {
            _id: tempId,
            ...newDonor,
            vitals: { pulse: newDonor.pulse, bloodPressure: newDonor.bloodPressure, weight: newDonor.weight },
            _syncStatus: 'syncing',
        };
        queryClient.setQueryData(['bloodDonors'], (old = []) => [...old, optimisticDonor]);
        setShowDonorModal(false);
        setNewDonor({ name: '', bloodGroup: 'A+', age: '', gender: 'M', phone: '', email: '', pulse: '', bloodPressure: '', weight: '' });
        toast.success('Donor registered (syncing in background)');
        syncQueue.enqueue({
            path: '/api/bloodbank/donors',
            method: 'POST',
            body: newDonor,
            tempId,
            queryKey: ['bloodDonors'],
            rollbackQueryKeys: [['bloodDonors']],
            previousData: [previousDonors],
        }, queryClient, {
            onSuccess: (data) => {
                queryClient.setQueryData(['bloodDonors'], (old = []) =>
                    old.map(d => d._id === tempId ? { ...data, _syncStatus: 'synced' } : d)
                );
                setTimeout(() => queryClient.setQueryData(['bloodDonors'], (old = []) =>
                    old.map(d => d._id === (data._id || tempId) ? { ...d, _syncStatus: undefined } : d)
                ), 2000);
            },
            onError: (err) => {
                queryClient.setQueryData(['bloodDonors'], (old = []) =>
                    old.map(d => d._id === tempId ? { ...d, _syncStatus: 'failed', _syncError: err.message } : d)
                );
            },
        });
    };

    const handleAddInventory = (e) => {
        e.preventDefault();
        const previousInventory = queryClient.getQueryData(['bloodInventory']) || [];
        const tempId = `temp-bag-${Date.now()}`;
        const optimisticBag = {
            _id: tempId,
            bagNumber: newBag.bagNumber,
            bloodGroup: newBag.bloodGroup,
            volumeMl: Number(newBag.volumeMl),
            expiryDate: new Date(Date.now() + 42 * 24 * 60 * 60 * 1000).toISOString(),
            status: 'available',
            _syncStatus: 'syncing',
        };
        queryClient.setQueryData(['bloodInventory'], (old = []) => [...old, optimisticBag]);
        setShowBagModal(false);
        setNewBag({ bagNumber: '', bloodGroup: 'A+', volumeMl: '350', donorId: '' });
        toast.success('Blood unit added to stock (syncing in background)');
        syncQueue.enqueue({
            path: '/api/bloodbank/inventory',
            method: 'POST',
            body: newBag,
            tempId,
            queryKey: ['bloodInventory'],
            rollbackQueryKeys: [['bloodInventory']],
            previousData: [previousInventory],
        }, queryClient, {
            onSuccess: (data) => {
                queryClient.setQueryData(['bloodInventory'], (old = []) =>
                    old.map(b => b._id === tempId ? { ...data, _syncStatus: 'synced' } : b)
                );
                setTimeout(() => queryClient.setQueryData(['bloodInventory'], (old = []) =>
                    old.map(b => b._id === (data._id || tempId) ? { ...b, _syncStatus: undefined } : b)
                ), 2000);
            },
            onError: (err) => {
                queryClient.setQueryData(['bloodInventory'], (old = []) =>
                    old.map(b => b._id === tempId ? { ...b, _syncStatus: 'failed', _syncError: err.message } : b)
                );
            },
        });
    };

    const handleCreateRequest = (e) => {
        e.preventDefault();
        const patient = patients.find(p => p._id === newRequest.patientId);
        const previousRequests = queryClient.getQueryData(['bloodRequests']) || [];
        const tempId = `temp-req-${Date.now()}`;
        const optimisticRequest = {
            _id: tempId,
            patientId: newRequest.patientId,
            patientName: patient ? `${patient.firstName} ${patient.lastName || ''}`.trim() : 'Unknown Patient',
            bloodGroup: newRequest.bloodGroup,
            unitsRequested: Number(newRequest.unitsRequested),
            crossmatchStatus: 'pending',
            status: 'pending',
            urgency: newRequest.urgency,
            _syncStatus: 'syncing',
        };
        queryClient.setQueryData(['bloodRequests'], (old = []) => [optimisticRequest, ...old]);
        setShowRequestModal(false);
        setNewRequest({ patientId: '', bloodGroup: 'A+', unitsRequested: '', urgency: 'routine' });
        toast.success('Blood request logged (syncing in background)');
        syncQueue.enqueue({
            path: '/api/bloodbank/requests',
            method: 'POST',
            body: newRequest,
            tempId,
            queryKey: ['bloodRequests'],
            rollbackQueryKeys: [['bloodRequests']],
            previousData: [previousRequests],
        }, queryClient, {
            onSuccess: (data) => {
                queryClient.setQueryData(['bloodRequests'], (old = []) =>
                    old.map(r => r._id === tempId ? { ...data, _syncStatus: 'synced' } : r)
                );
                setTimeout(() => queryClient.setQueryData(['bloodRequests'], (old = []) =>
                    old.map(r => r._id === (data._id || tempId) ? { ...r, _syncStatus: undefined } : r)
                ), 2000);
            },
            onError: (err) => {
                queryClient.setQueryData(['bloodRequests'], (old = []) =>
                    old.map(r => r._id === tempId ? { ...r, _syncStatus: 'failed', _syncError: err.message } : r)
                );
            },
        });
    };

    const handleCrossmatch = (reqId, status) => {
        const previousRequests = queryClient.getQueryData(['bloodRequests']) || [];
        queryClient.setQueryData(['bloodRequests'], (old = []) =>
            old.map(r => r._id === reqId ? { ...r, crossmatchStatus: status, _syncStatus: 'syncing' } : r)
        );
        toast.success(`Cross-match status marked as ${status.toUpperCase()} (syncing)`);
        syncQueue.enqueue({
            path: `/api/bloodbank/requests/${reqId}/crossmatch`,
            method: 'PUT',
            body: { crossmatchStatus: status, notes: 'Cross-matching completed successfully' },
            rollbackQueryKeys: [['bloodRequests']],
            previousData: [previousRequests],
        }, queryClient, {
            onSuccess: () => queryClient.setQueryData(['bloodRequests'], (old = []) =>
                old.map(r => r._id === reqId ? { ...r, _syncStatus: undefined } : r)
            ),
            onError: () => { queryClient.setQueryData(['bloodRequests'], previousRequests); },
        });
    };

    const handleIssueBlood = (reqId) => {
        const previousRequests  = queryClient.getQueryData(['bloodRequests'])  || [];
        const previousInventory = queryClient.getQueryData(['bloodInventory']) || [];
        queryClient.setQueryData(['bloodRequests'], (old = []) =>
            old.map(r => r._id === reqId ? { ...r, status: 'issued', _syncStatus: 'syncing' } : r)
        );
        toast.success('Issuing blood units (syncing in background)');
        syncQueue.enqueue({
            path: `/api/bloodbank/requests/${reqId}/issue`,
            method: 'PUT',
            body: {},
            rollbackQueryKeys: [['bloodRequests'], ['bloodInventory']],
            previousData: [previousRequests, previousInventory],
        }, queryClient, {
            onSuccess: () => {
                queryClient.setQueryData(['bloodRequests'], (old = []) =>
                    old.map(r => r._id === reqId ? { ...r, _syncStatus: undefined } : r)
                );
            },
            onError: () => {
                queryClient.setQueryData(['bloodRequests'],  previousRequests);
                queryClient.setQueryData(['bloodInventory'], previousInventory);
            },
        });
    };

    // Calculate aggregated inventory counts by blood group
    const counts = useMemo(() => {
        const groupCounts = { 'A+': 0, 'A-': 0, 'B+': 0, 'B-': 0, 'AB+': 0, 'AB-': 0, 'O+': 0, 'O-': 0 };
        inventory.forEach(bag => {
            if (bag.status === 'available' && groupCounts[bag.bloodGroup] !== undefined) {
                groupCounts[bag.bloodGroup]++;
            }
        });
        return groupCounts;
    }, [inventory]);

    return (
        <div className="p-6 space-y-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-gray-950 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                <div>
                    <h1 className="text-3xl font-extrabold text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-3">
                        <Heart className="text-rose-605" size={32} />
                        Blood Bank & Compatibility Desk
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 font-medium mt-1">Registry blood donors, manage blood groups inventory bags, and approve cross-matched unit issuances.</p>
                </div>
                {user?.role !== 'patient' && (
                    <div className="flex gap-2">
                        <button
                            onClick={() => setShowDonorModal(true)}
                            className="bg-slate-850 hover:bg-slate-900 dark:bg-slate-800 dark:hover:bg-slate-700 text-white font-semibold px-4 py-2.5 rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer"
                        >
                            <UserCheck size={18} />
                            Register Donor
                        </button>
                        <button
                            onClick={() => setShowBagModal(true)}
                            className="bg-rose-600 hover:bg-rose-700 text-white font-semibold px-4 py-2.5 rounded-xl transition-all shadow-lg hover:scale-[1.02] flex items-center gap-2 cursor-pointer"
                        >
                            <Plus size={18} />
                            Add Blood Unit
                        </button>
                    </div>
                )}
            </div>

            {/* Aggregated Inventory summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
                {Object.entries(counts).map(([group, val]) => (
                    <div key={group} className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm text-center relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-8 h-8 bg-rose-500/10 rounded-bl-full flex items-center justify-center">
                            <Heart size={12} className="text-rose-500" />
                        </div>
                        <span className="text-md font-extrabold text-slate-800 dark:text-slate-200 block">{group}</span>
                        <span className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-2 block">{val}</span>
                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mt-1">Units Stock</span>
                    </div>
                ))}
            </div>

            {/* Navigation Tabs */}
            <div className="flex gap-2 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl w-fit">
                <button
                    onClick={() => setActiveTab('inventory')}
                    className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all cursor-pointer ${activeTab === 'inventory' ? 'bg-white dark:bg-gray-800 text-slate-800 dark:text-white shadow-sm' : 'text-slate-650 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'}`}
                >
                    Inventory Bags
                </button>
                <button
                    onClick={() => setActiveTab('donors')}
                    className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all cursor-pointer ${activeTab === 'donors' ? 'bg-white dark:bg-gray-800 text-slate-800 dark:text-white shadow-sm' : 'text-slate-650 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'}`}
                >
                    Donors Registry
                </button>
                <button
                    onClick={() => setActiveTab('requests')}
                    className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all cursor-pointer ${activeTab === 'requests' ? 'bg-white dark:bg-gray-800 text-slate-800 dark:text-white shadow-sm' : 'text-slate-650 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'}`}
                >
                    Blood Requests & Issue
                </button>
            </div>

            {/* Inventory Tab Content */}
            {activeTab === 'inventory' && (
                <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        {loadingInventory ? (
                            <div className="p-6"><TableSkeleton rows={4} cols={5} /></div>
                        ) : (
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/50 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                        <th className="p-4">Bag Number</th>
                                        <th className="p-4">Blood Group</th>
                                        <th className="p-4">Volume (ML)</th>
                                        <th className="p-4">Expiry Date</th>
                                        <th className="p-4">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm text-slate-700 dark:text-slate-300">
                                    {inventory.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="p-8 text-center text-slate-400">No blood units in stock.</td>
                                        </tr>
                                    ) : (
                                        inventory.map(i => (
                                            <tr key={i._id} className="hover:bg-slate-50/30 dark:hover:bg-gray-850/50 transition-all">
                                                <td className="p-4 font-mono font-bold text-slate-800 dark:text-slate-100">{i.bagNumber}</td>
                                                <td className="p-4 font-extrabold text-rose-600 dark:text-rose-400">{i.bloodGroup}</td>
                                                <td className="p-4 font-semibold text-slate-600 dark:text-slate-400">{i.volumeMl} ml</td>
                                                <td className="p-4 font-medium text-slate-500 dark:text-slate-400">{new Date(i.expiryDate).toLocaleDateString()}</td>
                                                <td className="p-4">
                                                    <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full uppercase ${i.status === 'available' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-850 dark:text-slate-400'}`}>
                                                        {i.status}
                                                    </span>
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

            {/* Donors Registry Content */}
            {activeTab === 'donors' && (
                <div>
                    {loadingDonors ? (
                        <CardSkeleton count={3} cols={3} />
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {donors.map(d => (
                                <div key={d._id} className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm space-y-3">
                                    <div className="flex justify-between items-start">
                                        <span className="text-xs bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-455 font-extrabold px-2.5 py-0.5 rounded-md">{d.bloodGroup}</span>
                                        <span className="text-xs font-bold text-slate-400">Age: {d.age} | {d.gender}</span>
                                    </div>
                                    <div>
                                        <h3 className="font-extrabold text-slate-800 dark:text-slate-100 text-lg">{d.name}</h3>
                                        <p className="text-slate-500 dark:text-slate-400 font-medium text-xs mt-1">Phone: {d.phone}</p>
                                        <p className="text-slate-400 dark:text-slate-500 text-xs mt-0.5">BP: {d.vitals?.bloodPressure || 'N/A'} | Weight: {d.vitals?.weight || d.weight || 'N/A'}kg</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Blood Requests Tab Content */}
            {activeTab === 'requests' && (
                <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
                    <div className="p-4 bg-slate-50/50 dark:bg-slate-900/50 border-b dark:border-slate-800 flex items-center justify-between">
                        <span className="text-sm font-bold text-slate-655 dark:text-slate-300">Patient Requests & Issuance pipeline</span>
                        {user?.role !== 'patient' && (
                            <button
                                onClick={() => setShowRequestModal(true)}
                                className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs px-3 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer transition-all"
                            >
                                <Plus size={12} /> Log New Request
                            </button>
                        )}
                    </div>
                    <div className="overflow-x-auto">
                        {loadingRequests ? (
                            <div className="p-6"><TableSkeleton rows={4} cols={6} /></div>
                        ) : (
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/50 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                        <th className="p-4">Patient details</th>
                                        <th className="p-4">Blood group</th>
                                        <th className="p-4">Units</th>
                                        <th className="p-4">Cross-Match</th>
                                        <th className="p-4">Status</th>
                                        <th className="p-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm text-slate-700 dark:text-slate-300">
                                    {requests.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="p-8 text-center text-slate-400">No blood request records logged.</td>
                                        </tr>
                                    ) : (
                                        requests.map(r => (
                                            <tr key={r._id} className="hover:bg-slate-50/30 dark:hover:bg-gray-850/50 transition-all">
                                                <td className="p-4 font-bold text-slate-800 dark:text-slate-100">{r.patientName}</td>
                                                <td className="p-4 font-extrabold text-rose-600 dark:text-rose-400">{r.bloodGroup}</td>
                                                <td className="p-4 font-semibold text-slate-600 dark:text-slate-400">{r.unitsRequested} Unit(s)</td>
                                                <td className="p-4">
                                                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${r.crossmatchStatus === 'compatible' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400' : r.crossmatchStatus === 'incompatible' ? 'bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-850 dark:text-slate-400'}`}>
                                                        {(r.crossmatchStatus || 'pending').toUpperCase()}
                                                    </span>
                                                </td>
                                                <td className="p-4">
                                                    <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full uppercase ${r.status === 'issued' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400' : 'bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400'}`}>
                                                        {r.status}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-right flex justify-end gap-2">
                                                    {r.status !== 'issued' && user?.role !== 'patient' && (
                                                        <>
                                                            <button
                                                                onClick={() => handleCrossmatch(r._id, 'compatible')}
                                                                className="bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/35 text-indigo-700 dark:text-indigo-300 font-bold text-xs px-3 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer transition-all"
                                                            >
                                                                <ShieldCheck size={12} /> Mark Compatible
                                                            </button>
                                                            <button
                                                                onClick={() => handleCrossmatch(r._id, 'incompatible')}
                                                                className="bg-red-50 hover:bg-red-100 dark:bg-red-950/35 text-red-700 dark:text-red-400 font-bold text-xs px-3 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer transition-all"
                                                            >
                                                                <HeartCrack size={12} /> Incompatible
                                                            </button>
                                                            {r.crossmatchStatus === 'compatible' && (
                                                                <button
                                                                    onClick={() => handleIssueBlood(r._id)}
                                                                    className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs px-3 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer transition-all"
                                                                >
                                                                    <Layers size={12} /> Issue Units
                                                                </button>
                                                            )}
                                                        </>
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

            {/* Donor registration modal */}
            <AnimatePresence>
                {showDonorModal && (
                    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white dark:bg-gray-900 p-6 rounded-2xl border dark:border-slate-800 max-w-md w-full shadow-2xl space-y-4">
                            <div className="flex justify-between items-center">
                                <h3 className="text-xl font-extrabold text-slate-800 dark:text-slate-100">Register Blood Donor</h3>
                                <button onClick={() => setShowDonorModal(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"><X size={20} className="text-slate-500" /></button>
                            </div>
                            <form onSubmit={handleRegisterDonor} className="space-y-4">
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="col-span-2 space-y-1">
                                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400">Donor Name</label>
                                        <input
                                            type="text"
                                            required
                                            value={newDonor.name}
                                            onChange={e => setNewDonor({ ...newDonor, name: e.target.value })}
                                            className="input"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400">Blood Group</label>
                                        <select
                                            value={newDonor.bloodGroup}
                                            onChange={e => setNewDonor({ ...newDonor, bloodGroup: e.target.value })}
                                            className="input font-bold"
                                        >
                                            <option value="A+">A+</option>
                                            <option value="A-">A-</option>
                                            <option value="B+">B+</option>
                                            <option value="B-">B-</option>
                                            <option value="AB+">AB+</option>
                                            <option value="AB-">AB-</option>
                                            <option value="O+">O+</option>
                                            <option value="O-">O-</option>
                                        </select>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400">Age</label>
                                        <input
                                            type="number"
                                            required
                                            value={newDonor.age}
                                            onChange={e => setNewDonor({ ...newDonor, age: e.target.value })}
                                            className="input"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400">Pulse / Min</label>
                                        <input
                                            type="text"
                                            value={newDonor.pulse}
                                            onChange={e => setNewDonor({ ...newDonor, pulse: e.target.value })}
                                            placeholder="e.g. 72"
                                            className="input"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400">Blood Pressure</label>
                                        <input
                                            type="text"
                                            value={newDonor.bloodPressure}
                                            onChange={e => setNewDonor({ ...newDonor, bloodPressure: e.target.value })}
                                            placeholder="e.g. 120/80"
                                            className="input"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400">Phone</label>
                                        <input
                                            type="text"
                                            required
                                            value={newDonor.phone}
                                            onChange={e => setNewDonor({ ...newDonor, phone: e.target.value })}
                                            className="input"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400">Weight (KG)</label>
                                        <input
                                            type="number"
                                            required
                                            value={newDonor.weight}
                                            onChange={e => setNewDonor({ ...newDonor, weight: e.target.value })}
                                            className="input"
                                        />
                                    </div>
                                </div>
                                <div className="flex gap-2 justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
                                    <button
                                        type="button"
                                        onClick={() => setShowDonorModal(false)}
                                        className="btn btn-ghost"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="btn btn-primary"
                                    >
                                        Register Donor
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Add Bag Modal */}
            <AnimatePresence>
                {showBagModal && (
                    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white dark:bg-gray-900 p-6 rounded-2xl border dark:border-slate-800 max-w-md w-full shadow-2xl space-y-4">
                            <div className="flex justify-between items-center">
                                <h3 className="text-xl font-extrabold text-slate-800 dark:text-slate-100">Add Blood bag to Inventory</h3>
                                <button onClick={() => setShowBagModal(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"><X size={20} className="text-slate-500" /></button>
                            </div>
                            <form onSubmit={handleAddInventory} className="space-y-4">
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1 col-span-2">
                                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400">Bag Barcode Number</label>
                                        <input
                                            type="text"
                                            required
                                            value={newBag.bagNumber}
                                            onChange={e => setNewBag({ ...newBag, bagNumber: e.target.value })}
                                            placeholder="e.g. BAG-A938"
                                            className="input font-mono"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400">Blood Group</label>
                                        <select
                                            value={newBag.bloodGroup}
                                            onChange={e => setNewBag({ ...newBag, bloodGroup: e.target.value })}
                                            className="input font-bold"
                                        >
                                            <option value="A+">A+</option>
                                            <option value="A-">A-</option>
                                            <option value="B+">B+</option>
                                            <option value="B-">B-</option>
                                            <option value="AB+">AB+</option>
                                            <option value="AB-">AB-</option>
                                            <option value="O+">O+</option>
                                            <option value="O-">O-</option>
                                        </select>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400">Volume (ML)</label>
                                        <input
                                            type="number"
                                            required
                                            value={newBag.volumeMl}
                                            onChange={e => setNewBag({ ...newBag, volumeMl: e.target.value })}
                                            className="input"
                                        />
                                    </div>
                                </div>
                                <div className="flex gap-2 justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
                                    <button
                                        type="button"
                                        onClick={() => setShowBagModal(false)}
                                        className="btn btn-ghost"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="btn btn-primary"
                                    >
                                        Add Stock Bag
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Request blood modal */}
            <AnimatePresence>
                {showRequestModal && (
                    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white dark:bg-gray-900 p-6 rounded-2xl border dark:border-slate-800 max-w-md w-full shadow-2xl space-y-4">
                            <div className="flex justify-between items-center">
                                <h3 className="text-xl font-extrabold text-slate-800 dark:text-slate-100">Log Patient Blood Request</h3>
                                <button onClick={() => setShowRequestModal(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"><X size={20} className="text-slate-500" /></button>
                            </div>
                            <form onSubmit={handleCreateRequest} className="space-y-4">
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="col-span-2 space-y-1">
                                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400">Select Patient</label>
                                        <select
                                            required
                                            value={newRequest.patientId}
                                            onChange={e => setNewRequest({ ...newRequest, patientId: e.target.value })}
                                            className="input"
                                        >
                                            <option value="">-- Choose Patient --</option>
                                            {patients.map(p => (
                                                <option key={p._id} value={p._id}>{p.firstName} {p.lastName} ({p.phone})</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400">Blood Group</label>
                                        <select
                                            value={newRequest.bloodGroup}
                                            onChange={e => setNewRequest({ ...newRequest, bloodGroup: e.target.value })}
                                            className="input font-bold"
                                        >
                                            <option value="A+">A+</option>
                                            <option value="A-">A-</option>
                                            <option value="B+">B+</option>
                                            <option value="B-">B-</option>
                                            <option value="AB+">AB+</option>
                                            <option value="AB-">AB-</option>
                                            <option value="O+">O+</option>
                                            <option value="O-">O-</option>
                                        </select>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400">Units Requested</label>
                                        <input
                                            type="number"
                                            required
                                            value={newRequest.unitsRequested}
                                            onChange={e => setNewRequest({ ...newRequest, unitsRequested: e.target.value })}
                                            placeholder="e.g. 2"
                                            className="input"
                                        />
                                    </div>
                                </div>
                                <div className="flex gap-2 justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
                                    <button
                                        type="button"
                                        onClick={() => setShowRequestModal(false)}
                                        className="btn btn-ghost"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="btn btn-primary"
                                    >
                                        Request Blood
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
