import { useProfileRender } from '../utils/profiler';
import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import { Truck, Plus, Compass, MapPin, Phone, User, CheckCircle, Navigation, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { CardSkeleton, TableSkeleton } from '../components/common/Skeleton';
import syncQueue from '../utils/syncQueue';

export default function Ambulance() {
    useProfileRender('Ambulance', true);
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState('vehicles');

    const [showVehicleModal, setShowVehicleModal] = useState(false);
    const [showDispatchModal, setShowDispatchModal] = useState(false);

    const [newVehicle, setNewVehicle] = useState({ vehicleNumber: '', vehicleModel: '', driverName: '', driverPhone: '', status: 'available' });
    const [newDispatch, setNewDispatch] = useState({ callerName: '', callerPhone: '', pickupAddress: '', ambulanceId: '', severity: 'critical' });

    // GPS Simulation States
    const [simulatedRoute, setSimulatedRoute] = useState(null);
    const [progress, setProgress] = useState(0);

    // Queries
    const { data: vehicles = [], isLoading: loadingVehicles } = useQuery({
        queryKey: ['ambulances'],
        queryFn: async () => {
            const res = await fetch('/api/ambulance/vehicles', {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('hms.auth.token')}` }
            });
            if (!res.ok) throw new Error('Failed to load vehicles');
            return res.json();
        }
    });

    const { data: dispatches = [], isLoading: loadingDispatches } = useQuery({
        queryKey: ['ambulanceDispatches'],
        queryFn: async () => {
            const res = await fetch('/api/ambulance/dispatches', {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('hms.auth.token')}` }
            });
            if (!res.ok) throw new Error('Failed to load dispatches');
            return res.json();
        }
    });

    const handleCreateVehicle = (e) => {
        e.preventDefault();
        const previousVehicles = queryClient.getQueryData(['ambulances']) || [];
        const tempId = `temp-amb-${Date.now()}`;
        const optimisticVehicle = {
            _id: tempId,
            ...newVehicle,
            status: 'available',
            _syncStatus: 'syncing',
        };
        queryClient.setQueryData(['ambulances'], (old = []) => [...old, optimisticVehicle]);
        setShowVehicleModal(false);
        setNewVehicle({ vehicleNumber: '', vehicleModel: '', driverName: '', driverPhone: '', status: 'available' });
        toast.success('Ambulance vehicle registered successfully (syncing)');
        syncQueue.enqueue({
            path: '/api/ambulance/vehicles',
            method: 'POST',
            body: newVehicle,
            tempId,
            queryKey: ['ambulances'],
            rollbackQueryKeys: [['ambulances']],
            previousData: [previousVehicles],
        }, queryClient, {
            onSuccess: (data) => {
                queryClient.setQueryData(['ambulances'], (old = []) =>
                    old.map(v => v._id === tempId ? { ...data, _syncStatus: 'synced' } : v)
                );
                setTimeout(() => queryClient.setQueryData(['ambulances'], (old = []) =>
                    old.map(v => v._id === (data._id || tempId) ? { ...v, _syncStatus: undefined } : v)
                ), 2000);
            },
            onError: (err) => {
                queryClient.setQueryData(['ambulances'], (old = []) =>
                    old.map(v => v._id === tempId ? { ...v, _syncStatus: 'failed', _syncError: err.message } : v)
                );
            },
        });
    };

    const handleCreateDispatch = (e) => {
        e.preventDefault();
        const vehicle = vehicles.find(v => v._id === newDispatch.ambulanceId);
        const previousDispatches = queryClient.getQueryData(['ambulanceDispatches']) || [];
        const previousVehicles   = queryClient.getQueryData(['ambulances']) || [];
        const tempId = `temp-disp-${Date.now()}`;
        const optimisticDispatch = {
            _id: tempId,
            callerName: newDispatch.callerName,
            callerPhone: newDispatch.callerPhone,
            pickupAddress: newDispatch.pickupAddress,
            ambulanceId: newDispatch.ambulanceId,
            vehicleNumber: vehicle ? vehicle.vehicleNumber : 'Pending...',
            driverName: vehicle ? vehicle.driverName : 'Pending...',
            severity: newDispatch.severity,
            status: 'assigned',
            dispatchedAt: new Date().toISOString(),
            _syncStatus: 'syncing',
        };
        queryClient.setQueryData(['ambulanceDispatches'], (old = []) => [optimisticDispatch, ...old]);
        queryClient.setQueryData(['ambulances'], (old = []) =>
            old.map(v => v._id === newDispatch.ambulanceId ? { ...v, status: 'dispatched' } : v)
        );
        setShowDispatchModal(false);
        setNewDispatch({ callerName: '', callerPhone: '', pickupAddress: '', ambulanceId: '', severity: 'critical' });
        toast.success('Emergency dispatch initiated (syncing)');
        syncQueue.enqueue({
            path: '/api/ambulance/dispatches',
            method: 'POST',
            body: newDispatch,
            tempId,
            queryKey: ['ambulanceDispatches'],
            rollbackQueryKeys: [['ambulanceDispatches'], ['ambulances']],
            previousData: [previousDispatches, previousVehicles],
        }, queryClient, {
            onSuccess: (data) => {
                queryClient.setQueryData(['ambulanceDispatches'], (old = []) =>
                    old.map(d => d._id === tempId ? { ...data, _syncStatus: 'synced' } : d)
                );
                setTimeout(() => queryClient.setQueryData(['ambulanceDispatches'], (old = []) =>
                    old.map(d => d._id === (data._id || tempId) ? { ...d, _syncStatus: undefined } : d)
                ), 2000);
            },
            onError: (err) => {
                queryClient.setQueryData(['ambulanceDispatches'], (old = []) =>
                    old.map(d => d._id === tempId ? { ...d, _syncStatus: 'failed', _syncError: err.message } : d)
                );
                queryClient.setQueryData(['ambulances'], previousVehicles);
            },
        });
    };

    const handleUpdateDispatchStatus = (dispatchId, status) => {
        const previousDispatches = queryClient.getQueryData(['ambulanceDispatches']) || [];
        const previousVehicles   = queryClient.getQueryData(['ambulances']) || [];
        const dispatch = previousDispatches.find(d => d._id === dispatchId);
        queryClient.setQueryData(['ambulanceDispatches'], (old = []) =>
            old.map(d => d._id === dispatchId ? { ...d, status, _syncStatus: 'syncing' } : d)
        );
        if (status === 'completed' && dispatch) {
            queryClient.setQueryData(['ambulances'], (old = []) =>
                old.map(v => v._id === dispatch.ambulanceId ? { ...v, status: 'available' } : v)
            );
        }
        toast.success(`Dispatch status updated to ${status.toUpperCase()} (syncing)`);
        syncQueue.enqueue({
            path: `/api/ambulance/dispatches/${dispatchId}`,
            method: 'PUT',
            body: { status },
            rollbackQueryKeys: [['ambulanceDispatches'], ['ambulances']],
            previousData: [previousDispatches, previousVehicles],
        }, queryClient, {
            onSuccess: () => queryClient.setQueryData(['ambulanceDispatches'], (old = []) =>
                old.map(d => d._id === dispatchId ? { ...d, _syncStatus: undefined } : d)
            ),
            onError: () => {
                queryClient.setQueryData(['ambulanceDispatches'], previousDispatches);
                queryClient.setQueryData(['ambulances'],          previousVehicles);
            },
        });
    };

    // Simulate GPS route update loop for active dispatch
    useEffect(() => {
        const active = dispatches.find(d => d.status === 'assigned' || d.status === 'enroute');
        if (active) {
            setSimulatedRoute(active);
            const interval = setInterval(() => {
                setProgress(prev => {
                    if (prev >= 100) {
                        clearInterval(interval);
                        return 100;
                    }
                    return prev + 5;
                });
            }, 1000);
            return () => clearInterval(interval);
        } else {
            setSimulatedRoute(null);
            setProgress(0);
        }
    }, [dispatches]);

    return (
        <div className="p-6 space-y-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-gray-950 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                <div>
                    <h1 className="text-3xl font-extrabold text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-3">
                        <Truck className="text-indigo-650" size={32} />
                        Ambulance Dispatch & GPS Control
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 font-medium mt-1">Manage emergency vehicles, driver contacts, and track dispatches live.</p>
                </div>
                {user?.role !== 'patient' && (
                    <div className="flex gap-2">
                        <button
                            onClick={() => setShowVehicleModal(true)}
                            className="bg-slate-850 hover:bg-slate-900 dark:bg-slate-800 dark:hover:bg-slate-700 text-white font-semibold px-4 py-2.5 rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer"
                        >
                            <Plus size={18} />
                            Add Vehicle
                        </button>
                        <button
                            onClick={() => setShowDispatchModal(true)}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 py-2.5 rounded-xl transition-all shadow-lg hover:scale-[1.02] flex items-center gap-2 cursor-pointer"
                        >
                            <Compass size={18} />
                            Emergency Dispatch
                        </button>
                    </div>
                )}
            </div>

            {/* Navigation Tabs */}
            <div className="flex gap-2 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl w-fit">
                <button
                    onClick={() => setActiveTab('vehicles')}
                    className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all cursor-pointer ${activeTab === 'vehicles' ? 'bg-white dark:bg-gray-800 text-slate-800 dark:text-white shadow-sm' : 'text-slate-650 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'}`}
                >
                    Vehicles & Drivers
                </button>
                <button
                    onClick={() => setActiveTab('dispatches')}
                    className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all cursor-pointer ${activeTab === 'dispatches' ? 'bg-white dark:bg-gray-800 text-slate-800 dark:text-white shadow-sm' : 'text-slate-655 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'}`}
                >
                    Dispatches Logs
                </button>
            </div>

            {/* Vehicles Tab Content */}
            {activeTab === 'vehicles' && (
                <div>
                    {loadingVehicles ? (
                        <CardSkeleton count={3} cols={3} />
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {vehicles.map(v => (
                                <div key={v._id} className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm space-y-3 relative overflow-hidden">
                                    <div className="flex justify-between items-start">
                                        <span className="text-xs bg-indigo-50 dark:bg-indigo-950/35 text-indigo-700 dark:text-indigo-300 font-extrabold px-2.5 py-0.5 rounded-md">{v.vehicleNumber}</span>
                                        <span className={`text-xs font-bold px-2 py-0.5 rounded uppercase ${v.status === 'available' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-455' : 'bg-rose-50 text-rose-700 dark:bg-rose-955/20 dark:text-rose-455'}`}>
                                            {v.status}
                                        </span>
                                    </div>
                                    <div className="space-y-2">
                                        <h3 className="font-extrabold text-slate-800 dark:text-slate-100 text-lg">{v.vehicleModel}</h3>
                                        <p className="text-slate-600 dark:text-slate-355 text-sm font-semibold flex items-center gap-1.5">
                                            <User size={14} className="text-slate-400" />
                                            Driver: {v.driverName}
                                        </p>
                                        <p className="text-slate-500 dark:text-slate-400 text-xs font-medium flex items-center gap-1.5">
                                            <Phone size={14} className="text-slate-400" />
                                            Phone: {v.driverPhone}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Dispatches Tab Content */}
            {activeTab === 'dispatches' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Dispatches list (left 2 columns) */}
                    <div className="lg:col-span-2 space-y-4">
                        {loadingDispatches ? (
                            <TableSkeleton rows={4} cols={5} />
                        ) : dispatches.length === 0 ? (
                            <div className="bg-white dark:bg-gray-900 p-8 rounded-2xl border dark:border-slate-800 text-center text-slate-400">
                                No emergency dispatches logged.
                            </div>
                        ) : (
                            dispatches.map(d => (
                                <div key={d._id} className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 hover:border-indigo-100 dark:hover:border-indigo-900 shadow-sm transition-all space-y-3">
                                    <div className="flex justify-between items-start">
                                        <span className="text-xs bg-red-50 dark:bg-red-955/20 text-red-700 dark:text-red-400 font-bold px-2 py-0.5 rounded uppercase">{d.severity}</span>
                                        <span className={`text-xs font-bold px-2 py-0.5 rounded uppercase ${d.status === 'completed' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400' : 'bg-amber-50 text-amber-700 dark:bg-amber-955/20 dark:text-amber-400'}`}>
                                            {d.status}
                                        </span>
                                    </div>
                                    <div className="space-y-1">
                                        <h3 className="font-extrabold text-slate-800 dark:text-slate-100 text-md flex items-center gap-1">
                                            <MapPin size={16} className="text-red-500" />
                                            {d.pickupAddress}
                                        </h3>
                                        <p className="text-slate-500 dark:text-slate-400 text-xs font-semibold">Caller: {d.callerName} ({d.callerPhone})</p>
                                        <p className="text-slate-400 dark:text-slate-555 text-xs font-medium">Ambulance: {d.vehicleNumber} | Driver: {d.driverName}</p>
                                    </div>
                                    <div className="flex justify-end gap-2 border-t dark:border-slate-800 pt-3">
                                        {d.status === 'assigned' && (
                                            <button
                                                onClick={() => handleUpdateDispatchStatus(d._id, 'enroute')}
                                                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-3.5 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer transition-all"
                                            >
                                                Mark En Route
                                            </button>
                                        )}
                                        {d.status === 'enroute' && (
                                            <button
                                                onClick={() => handleUpdateDispatchStatus(d._id, 'completed')}
                                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3.5 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer transition-all"
                                            >
                                                <CheckCircle size={12} /> Mark Completed
                                            </button>
                                        )}
                                        {d.status === 'completed' && (
                                            <span className="text-emerald-600 dark:text-emerald-400 font-bold text-xs">Dispatch Mission Successful</span>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* GPS route tracking simulator (right 1 column) */}
                    <div className="lg:col-span-1">
                        {simulatedRoute ? (
                            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl text-slate-200 space-y-4 sticky top-6">
                                <div className="border-b border-slate-800 pb-2">
                                    <h4 className="font-bold text-white text-md flex items-center gap-1">
                                        <Navigation className="text-indigo-400 animate-spin" size={18} style={{ animationDuration: '4s' }} />
                                        GPS Tracking Console
                                    </h4>
                                    <p className="text-slate-400 text-xs mt-0.5">Tracking vehicle: {simulatedRoute.vehicleNumber}</p>
                                </div>

                                <div className="space-y-4 font-mono text-xs">
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">STATUS:</span>
                                        <span className="text-emerald-400 font-bold uppercase">{simulatedRoute.status}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">DESTINATION:</span>
                                        <span className="text-white text-right max-w-[150px] truncate">{simulatedRoute.pickupAddress}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">SPEED / ETA:</span>
                                        <span className="text-indigo-300">54 km/h | {Math.max(1, Math.round((100 - progress) / 10))} mins</span>
                                    </div>

                                    {/* Simulated Route progress line */}
                                    <div className="space-y-1 pt-2">
                                        <div className="flex justify-between text-[10px] text-slate-500 font-bold">
                                            <span>CLINIC</span>
                                            <span>{Math.round(progress)}% EN ROUTE</span>
                                            <span>DESTINATION</span>
                                        </div>
                                        <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden border border-slate-700 flex">
                                            <div className="bg-indigo-500 h-full rounded-full transition-all duration-1000" style={{ width: `${progress}%` }}></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-slate-50/50 dark:bg-slate-900/50 p-6 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-slate-400">
                                GPS Tracking will initialize automatically when an emergency dispatch is en route.
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Add Vehicle Modal */}
            <AnimatePresence>
                {showVehicleModal && (
                    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white dark:bg-gray-900 p-6 rounded-2xl border dark:border-slate-800 max-w-md w-full shadow-2xl space-y-4">
                            <div className="flex justify-between items-center">
                                <h3 className="text-xl font-extrabold text-slate-800 dark:text-slate-100">Register Ambulance Vehicle</h3>
                                <button onClick={() => setShowVehicleModal(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"><X size={20} className="text-slate-500" /></button>
                            </div>
                            <form onSubmit={handleCreateVehicle} className="space-y-4">
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400">Vehicle Number</label>
                                        <input
                                            type="text"
                                            required
                                            value={newVehicle.vehicleNumber}
                                            onChange={e => setNewVehicle({ ...newVehicle, vehicleNumber: e.target.value })}
                                            placeholder="e.g. DL-1CA-5643"
                                            className="input font-mono"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400">Vehicle Model</label>
                                        <input
                                            type="text"
                                            required
                                            value={newVehicle.vehicleModel}
                                            onChange={e => setNewVehicle({ ...newVehicle, vehicleModel: e.target.value })}
                                            placeholder="e.g. Force Traveler"
                                            className="input"
                                        />
                                    </div>
                                    <div className="space-y-1 col-span-2">
                                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400">Driver Name</label>
                                        <input
                                            type="text"
                                            required
                                            value={newVehicle.driverName}
                                            onChange={e => setNewVehicle({ ...newVehicle, driverName: e.target.value })}
                                            className="input"
                                        />
                                    </div>
                                    <div className="space-y-1 col-span-2">
                                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400">Driver Phone</label>
                                        <input
                                            type="text"
                                            required
                                            value={newVehicle.driverPhone}
                                            onChange={e => setNewVehicle({ ...newVehicle, driverPhone: e.target.value })}
                                            className="input font-semibold"
                                        />
                                    </div>
                                </div>
                                <div className="flex gap-2 justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
                                    <button
                                        type="button"
                                        onClick={() => setShowVehicleModal(false)}
                                        className="btn btn-ghost"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="btn btn-primary"
                                    >
                                        Add Vehicle
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Emergency Dispatch Modal */}
            <AnimatePresence>
                {showDispatchModal && (
                    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white dark:bg-gray-900 p-6 rounded-2xl border dark:border-slate-800 max-w-md w-full shadow-2xl space-y-4">
                            <div className="flex justify-between items-center">
                                <h3 className="text-xl font-extrabold text-slate-800 dark:text-slate-100">Dispatch Emergency Ambulance</h3>
                                <button onClick={() => setShowDispatchModal(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"><X size={20} className="text-slate-500" /></button>
                            </div>
                            <form onSubmit={handleCreateDispatch} className="space-y-4">
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="col-span-2 space-y-1">
                                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400">Caller / Emergency Contact Name</label>
                                        <input
                                            type="text"
                                            required
                                            value={newDispatch.callerName}
                                            onChange={e => setNewDispatch({ ...newDispatch, callerName: e.target.value })}
                                            className="input"
                                        />
                                    </div>
                                    <div className="col-span-2 space-y-1">
                                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400">Caller Phone</label>
                                        <input
                                            type="text"
                                            required
                                            value={newDispatch.callerPhone}
                                            onChange={e => setNewDispatch({ ...newDispatch, callerPhone: e.target.value })}
                                            className="input font-semibold"
                                        />
                                    </div>
                                    <div className="col-span-2 space-y-1">
                                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400">Pickup Address / Location</label>
                                        <input
                                            type="text"
                                            required
                                            value={newDispatch.pickupAddress}
                                            onChange={e => setNewDispatch({ ...newDispatch, pickupAddress: e.target.value })}
                                            placeholder="Complete emergency location address..."
                                            className="input text-sm"
                                        />
                                    </div>
                                    <div className="space-y-1 col-span-2">
                                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400">Select Available Ambulance</label>
                                        <select
                                            required
                                            value={newDispatch.ambulanceId}
                                            onChange={e => setNewDispatch({ ...newDispatch, ambulanceId: e.target.value })}
                                            className="input font-semibold"
                                        >
                                            <option value="">-- Select Available vehicle --</option>
                                            {vehicles.filter(v => v.status === 'available').map(v => (
                                                <option key={v._id} value={v._id}>{v.vehicleNumber} ({v.driverName})</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <div className="flex gap-2 justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
                                    <button
                                        type="button"
                                        onClick={() => setShowDispatchModal(false)}
                                        className="btn btn-ghost"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="btn btn-primary bg-red-600 hover:bg-red-700 border-none"
                                    >
                                        Dispatch Now
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
