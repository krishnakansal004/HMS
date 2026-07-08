import { useProfileRender } from '../utils/profiler';
import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import { Shield, CheckCircle, RefreshCw, Send, Plus } from 'lucide-react';
import { authFetch } from '../services/api';
import { TableSkeleton } from '../components/common/Skeleton';
import syncQueue from '../utils/syncQueue';

// ─── Helper: fetch from any ABDM endpoint ───────────────────────────────────
async function abdmFetch(path, options = {}) {
    return authFetch(path, options);
}

async function fetchConsents()  { return abdmFetch('/api/abdm/consents'); }
async function fetchPatients()  { return abdmFetch('/api/patients'); }

// ─── Component ───────────────────────────────────────────────────────────────
export default function AbdmIntegration() {
    useProfileRender('AbdmIntegration', true);
    const { user }      = useAuth();
    const queryClient   = useQueryClient();
    const [activeTab, setActiveTab]           = useState('verify');

    // ABHA Verification states
    const [abhaId, setAbhaId]                 = useState('');
    const [otp, setOtp]                       = useState('');
    const [txnId, setTxnId]                   = useState(null);
    const [step, setStep]                     = useState(1);
    const [verifiedProfile, setVerifiedProfile] = useState(null);

    // Consent modal state
    const [showConsentModal, setShowConsentModal] = useState(false);
    const [newConsent, setNewConsent]             = useState({ patientId: '', purpose: 'Clinical Consult', dataTypes: ['OPD', 'Prescription', 'LIS'] });

    // FHIR sync state
    const [syncLog, setSyncLog]               = useState([]);
    const [syncingOrder, setSyncingOrder]     = useState(null);

    // ─── Queries ───────────────────────────────────────────────────────────
    const { data: consents = [], isLoading: loadingConsents } = useQuery({
        queryKey: ['abdm-consents'],
        queryFn: fetchConsents,
    });

    const { data: patients = [] } = useQuery({
        queryKey: ['patients'],
        queryFn: fetchPatients,
    });

    // ─── ABHA Verification ─────────────────────────────────────────────────
    const handleSendOtp = async (e) => {
        e.preventDefault();
        try {
            const data = await authFetch('/api/abdm/verify-abha/otp', {
                method: 'POST',
                body: JSON.stringify({ abhaId }),
            });
            setTxnId(data.txnId);
            setStep(2);
            toast.success('Simulated OTP sent to registered number');
        } catch { toast.error('OTP request failed'); }
    };

    const handleConfirmOtp = async (e) => {
        e.preventDefault();
        try {
            const data = await authFetch('/api/abdm/verify-abha/confirm', {
                method: 'POST',
                body: JSON.stringify({ abhaId, otp, txnId }),
            });
            setVerifiedProfile(data.abhaDetails);
            setStep(3);
            toast.success('ABHA ID Verified successfully');
        } catch (err) {
            toast.error(err?.message || 'Verification failed');
        }
    };

    // ─── Consent: Create (Optimistic) ──────────────────────────────────────
    const handleCreateConsent = async (e) => {
        e.preventDefault();
        const prevConsents = queryClient.getQueryData(['abdm-consents']) || [];

        // Optimistic entry
        const tempConsent = {
            _id:        `temp-consent-${Date.now()}`,
            consentId:  `PENDING-${Date.now()}`,
            patientName: patients.find(p => p._id === newConsent.patientId)
                ? `${patients.find(p => p._id === newConsent.patientId).firstName} ${patients.find(p => p._id === newConsent.patientId).lastName}`
                : 'Unknown',
            purpose:    newConsent.purpose,
            dataTypes:  newConsent.dataTypes,
            status:     'requested',
        };
        queryClient.setQueryData(['abdm-consents'], (old = []) => [tempConsent, ...old]);

        setShowConsentModal(false);
        setNewConsent({ patientId: '', purpose: 'Clinical Consult', dataTypes: ['OPD', 'Prescription', 'LIS'] });
        toast.success('Consent request sent (syncing in background)');

        const tempId = tempConsent._id;
        syncQueue.enqueue({
            path: '/api/abdm/consents',
            method: 'POST',
            body: newConsent,
            tempId,
            queryKey: ['abdm-consents'],
            rollbackQueryKeys: [['abdm-consents']],
            previousData: [prevConsents],
        }, queryClient, {
            onSuccess: (data) => {
                queryClient.setQueryData(['abdm-consents'], (old = []) =>
                    old.map(c => c._id === tempId ? { ...data, _syncStatus: 'synced' } : c)
                );
                setTimeout(() => queryClient.setQueryData(['abdm-consents'], (old = []) =>
                    old.map(c => c._id === (data._id || tempId) ? { ...c, _syncStatus: undefined } : c)
                ), 2000);
            },
            onError: (err) => {
                queryClient.setQueryData(['abdm-consents'], (old = []) =>
                    old.map(c => c._id === tempId ? { ...c, _syncStatus: 'failed', _syncError: err.message } : c)
                );
            },
        });
    };

    // ─── Consent: Update Status (Optimistic) ───────────────────────────────
    const handleUpdateConsent = (consentId, status) => {
        const prevConsents = queryClient.getQueryData(['abdm-consents']) || [];

        // Optimistic update
        queryClient.setQueryData(['abdm-consents'], (old = []) =>
            old.map(c => c._id === consentId ? { ...c, status } : c)
        );
        toast.success(`Consent marked ${status}`);

        syncQueue.enqueue({
            path: `/api/abdm/consents/${consentId}/status`,
            method: 'PUT',
            body: { status },
            rollbackQueryKeys: [['abdm-consents']],
            previousData: [prevConsents],
        }, queryClient, {
            onSuccess: () => queryClient.setQueryData(['abdm-consents'], (old = []) =>
                old.map(c => c._id === consentId ? { ...c, _syncStatus: undefined } : c)
            ),
            onError: () => {
                queryClient.setQueryData(['abdm-consents'], prevConsents);
                toast.error('Failed to update consent status. Reverted.');
            },
        });
    };

    // ─── FHIR Record Sync ──────────────────────────────────────────────────
    const handleSyncRecord = async (patientId, type, recordId) => {
        setSyncingOrder(recordId);
        try {
            const data = await authFetch('/api/abdm/sync-records', {
                method: 'POST',
                body: JSON.stringify({ patientId, recordType: type, recordId }),
            });
            toast.success('FHIR Record synced with ABDM Health Repository');
            setSyncLog(prev => [{ id: data.bundleId, type, patientId, timestamp: new Date() }, ...prev]);
        } catch { toast.error('Record sync failed'); }
        setSyncingOrder(null);
    };

    return (
        <div className="p-6 space-y-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/60 backdrop-blur-md p-6 rounded-2xl border border-slate-100 shadow-sm">
                <div>
                    <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight flex items-center gap-3">
                        <Shield className="text-emerald-600 animate-pulse" size={32} />
                        ABDM / Ayushman Bharat Digital Mission
                    </h1>
                    <p className="text-slate-500 font-medium mt-1">Verify health lockers, track FHIR standard digital records, and audit consent permissions.</p>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex gap-2 bg-slate-100 p-1 rounded-xl w-fit">
                {[
                    { key: 'verify',   label: 'ABHA Verification' },
                    { key: 'consents', label: 'Consent Logs' },
                    { key: 'sync',     label: 'FHIR Records Sync' },
                ].map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all cursor-pointer ${activeTab === tab.key ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-600 hover:text-slate-800'}`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* ── ABHA Verification ─────────────────────────────────────── */}
            {activeTab === 'verify' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                        <h3 className="text-xl font-extrabold text-slate-800">Verify ABHA ID (Aadhaar Simulator)</h3>

                        {step === 1 && (
                            <form onSubmit={handleSendOtp} className="space-y-4 max-w-md">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-500">ABHA Number or Address</label>
                                    <input
                                        type="text"
                                        required
                                        value={abhaId}
                                        onChange={e => setAbhaId(e.target.value)}
                                        placeholder="e.g. karan@sbx or 12-3456-7890-1234"
                                        className="px-3 py-2 w-full border rounded-xl bg-white"
                                    />
                                </div>
                                <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2 rounded-xl text-sm transition-all cursor-pointer flex items-center gap-2">
                                    Generate Aadhaar OTP <Send size={14} />
                                </button>
                            </form>
                        )}

                        {step === 2 && (
                            <form onSubmit={handleConfirmOtp} className="space-y-4 max-w-md">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-500 block">Enter OTP (Simulated: 123456)</label>
                                    <input
                                        type="text"
                                        required
                                        value={otp}
                                        onChange={e => setOtp(e.target.value)}
                                        placeholder="123456"
                                        className="px-3 py-2 w-full border rounded-xl bg-white font-mono text-center tracking-widest text-lg"
                                    />
                                    <span className="text-[10px] font-bold text-slate-400">OTP transaction: {txnId}</span>
                                </div>
                                <div className="flex gap-2">
                                    <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2 rounded-xl text-sm transition-all cursor-pointer">
                                        Verify Profile
                                    </button>
                                    <button type="button" onClick={() => setStep(1)} className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold px-4 py-2 rounded-xl text-sm cursor-pointer">
                                        Back
                                    </button>
                                </div>
                            </form>
                        )}

                        {step === 3 && verifiedProfile && (
                            <div className="bg-emerald-50/50 p-6 rounded-2xl border border-emerald-100 space-y-4">
                                <div className="flex items-center gap-2 text-emerald-700 font-extrabold">
                                    <CheckCircle size={20} /> ABHA verified profile loaded
                                </div>
                                <div className="grid grid-cols-2 gap-4 text-slate-700 font-semibold text-sm">
                                    <p><span className="text-slate-400 text-xs block">Full Name:</span> {verifiedProfile.name}</p>
                                    <p><span className="text-slate-400 text-xs block">ABHA Number:</span> {verifiedProfile.abhaNumber}</p>
                                    <p><span className="text-slate-400 text-xs block">ABHA Address:</span> {verifiedProfile.abhaAddress}</p>
                                    <p><span className="text-slate-400 text-xs block">Contact Phone:</span> {verifiedProfile.phone}</p>
                                    <p className="col-span-2"><span className="text-slate-400 text-xs block">Aadhaar Address:</span> {verifiedProfile.address}</p>
                                </div>
                                <button
                                    onClick={() => { setStep(1); setAbhaId(''); setVerifiedProfile(null); }}
                                    className="bg-slate-800 hover:bg-slate-900 text-white font-bold px-4 py-2 rounded-xl text-xs transition-all cursor-pointer"
                                >
                                    Verify another ID
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="lg:col-span-1 bg-slate-50/50 p-6 rounded-2xl border border-dashed border-slate-200 flex flex-col justify-between">
                        <div className="space-y-2">
                            <h4 className="font-extrabold text-slate-700 text-md">Ayushman Bharat Health Account</h4>
                            <p className="text-slate-500 text-xs leading-relaxed">
                                ABHA is a 14-digit digital ID designed by the GoI to unify clinical records across certified clinics, labs, and hospitals nationwide. Verify patient ABHAs to sync diagnoses securely.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Consent Logs ──────────────────────────────────────────── */}
            {activeTab === 'consents' && (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                    <div className="p-4 bg-slate-50/50 border-b flex items-center justify-between">
                        <span className="text-sm font-bold text-slate-600">Patient Data Consent Requests</span>
                        {user?.role !== 'patient' && (
                            <button
                                onClick={() => setShowConsentModal(true)}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-3 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer transition-all"
                            >
                                <Plus size={12} /> Request Consent
                            </button>
                        )}
                    </div>

                    {loadingConsents ? (
                        <div className="p-6"><TableSkeleton rows={4} cols={5} /></div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b bg-slate-50/30 text-xs font-bold text-slate-500 uppercase tracking-wider">
                                        <th className="p-4">Patient details</th>
                                        <th className="p-4">Consent ID</th>
                                        <th className="p-4">Purpose</th>
                                        <th className="p-4">Sync categories</th>
                                        <th className="p-4">Status</th>
                                        <th className="p-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y text-sm text-slate-700">
                                    {consents.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="p-8 text-center text-slate-400">No active consent requests logged.</td>
                                        </tr>
                                    ) : consents.map(c => (
                                        <tr key={c._id} className="hover:bg-slate-50/30 transition-all">
                                            <td className="p-4 font-bold text-slate-800">{c.patientName}</td>
                                            <td className="p-4 font-mono text-xs">{c.consentId}</td>
                                            <td className="p-4 font-semibold text-slate-600">{c.purpose}</td>
                                            <td className="p-4">
                                                <div className="flex flex-wrap gap-1">
                                                    {c.dataTypes?.map((t, idx) => (
                                                        <span key={idx} className="text-[10px] bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded border border-slate-200">{t}</span>
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full uppercase ${c.status === 'granted' ? 'bg-emerald-50 text-emerald-700' : c.status === 'denied' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>
                                                    {c.status}
                                                </span>
                                            </td>
                                            <td className="p-4 text-right flex justify-end gap-2">
                                                {c.status === 'requested' && user?.role === 'patient' && (
                                                    <>
                                                        <button
                                                            onClick={() => handleUpdateConsent(c._id, 'granted')}
                                                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3 py-1.5 rounded-lg cursor-pointer transition-all"
                                                        >
                                                            Approve
                                                        </button>
                                                        <button
                                                            onClick={() => handleUpdateConsent(c._id, 'denied')}
                                                            className="bg-red-50 hover:bg-red-100 text-red-700 font-bold text-xs px-3 py-1.5 rounded-lg cursor-pointer transition-all"
                                                        >
                                                            Deny
                                                        </button>
                                                    </>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* ── FHIR Records Sync ─────────────────────────────────────── */}
            {activeTab === 'sync' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                        <h3 className="text-xl font-bold text-slate-800">FHIR Record compilation gateway</h3>
                        <p className="text-slate-500 text-sm">Select verified patients to bundle diagnoses, prescriptions, or lab test outcomes into FHIR json records and push to NDHM gateway.</p>

                        <div className="space-y-3 pt-3 border-t">
                            {patients.map(p => (
                                <div key={p._id} className="flex justify-between items-center p-4 border rounded-xl hover:bg-slate-50">
                                    <div>
                                        <h4 className="font-bold text-slate-800">{p.firstName} {p.lastName}</h4>
                                        <p className="text-xs text-slate-400">Phone: {p.phone} | Email: {p.email || 'None'}</p>
                                    </div>
                                    <button
                                        onClick={() => handleSyncRecord(p._id, 'DiagnosticReport', p._id)}
                                        disabled={syncingOrder === p._id}
                                        className="bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer transition-all disabled:opacity-55"
                                    >
                                        <RefreshCw size={12} className={syncingOrder === p._id ? 'animate-spin' : ''} /> Sync Records
                                    </button>
                                </div>
                            ))}
                            {patients.length === 0 && (
                                <p className="text-slate-400 text-sm italic text-center py-8">No patients found.</p>
                            )}
                        </div>
                    </div>

                    <div className="lg:col-span-1 bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl text-slate-200 space-y-4">
                        <h4 className="font-bold text-white text-md uppercase border-b border-slate-800 pb-2">Sync Transaction Logs</h4>
                        <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
                            {syncLog.length === 0 ? (
                                <p className="text-slate-500 text-xs italic text-center py-6">No records synced in this session.</p>
                            ) : syncLog.map(log => (
                                <div key={log.id} className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1 font-mono text-[10px] text-slate-400">
                                    <p className="text-emerald-400 font-bold">BUNDLE: {log.id}</p>
                                    <p>TYPE: {log.type}</p>
                                    <p>TIME: {log.timestamp.toLocaleTimeString()}</p>
                                    <p className="text-[9px] text-slate-600">HIP GATEWAY: NDHM-PROD-HIP-0382</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* ── Request Consent Modal ─────────────────────────────────── */}
            {showConsentModal && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <form onSubmit={handleCreateConsent} className="bg-white p-6 rounded-2xl border max-w-md w-full shadow-2xl space-y-4">
                        <h3 className="text-xl font-extrabold text-slate-800">Request ABDM Record Access</h3>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="col-span-2 space-y-1">
                                <label className="text-xs font-bold text-slate-500">Patient</label>
                                <select
                                    required
                                    value={newConsent.patientId}
                                    onChange={e => setNewConsent({ ...newConsent, patientId: e.target.value })}
                                    className="px-3 py-2 w-full border rounded-xl bg-white font-semibold"
                                >
                                    <option value="">-- Choose Patient --</option>
                                    {patients.map(p => (
                                        <option key={p._id} value={p._id}>{p.firstName} {p.lastName} ({p.phone})</option>
                                    ))}
                                </select>
                            </div>
                            <div className="col-span-2 space-y-1">
                                <label className="text-xs font-bold text-slate-500">Purpose</label>
                                <input
                                    type="text"
                                    required
                                    value={newConsent.purpose}
                                    onChange={e => setNewConsent({ ...newConsent, purpose: e.target.value })}
                                    placeholder="e.g. Diagnostics Review / Consultation"
                                    className="px-3 py-2 w-full border rounded-xl bg-white text-sm"
                                />
                            </div>
                        </div>
                        <div className="flex gap-2 justify-end pt-2">
                            <button
                                type="button"
                                onClick={() => setShowConsentModal(false)}
                                className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold px-4 py-2 rounded-xl cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2 rounded-xl cursor-pointer"
                            >
                                Send Request
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}
