import { useProfileRender } from '../utils/profiler';

import { useEffect, useState } from 'react';
import { listDoctorApplications, approveDoctorApplication, rejectDoctorApplication } from '../services/api';
import { motion } from 'framer-motion'
import { Check, X, Clock, MapPin, GraduationCap, Briefcase, Mail } from 'lucide-react'
import PageContainer from '../components/Admin/PageContainer'
import PageHeader from '../components/Admin/PageHeader'
import { toast } from 'react-toastify';

export default function DoctorApprovals() {
    useProfileRender('DoctorApprovals', true);
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [filter, setFilter] = useState('pending');

    const load = async () => {
        setLoading(true);
        try { setItems(await listDoctorApplications()); }
        finally { setLoading(false); }
    };

    useEffect(() => { load(); }, []);

    const approve = async (id) => {
        try {
            await approveDoctorApplication(id);
            toast.success('Doctor application approved')
            load();
        } catch (e) { toast.error('Failed to approve') }
    };

    const reject = async (id) => {
        if (!confirm('Reject this application?')) return
        try {
            await rejectDoctorApplication(id);
            toast.success('Doctor application rejected')
            load();
        } catch (e) { toast.error('Failed to reject') }
    };

    const filtered = items.filter(i => !filter || i.status === filter);

    return (
        <PageContainer>
            <PageHeader
                title="Doctor Applications"
                breadcrumbs={[{ label: 'Dashboard', to: '/' }, { label: 'Approvals' }]}
                actions={
                    <select
                        className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 font-medium text-slate-700 cursor-pointer hover:border-blue-300 transition-colors"
                        value={filter}
                        onChange={e => setFilter(e.target.value)}
                    >
                        <option value="">All Applications</option>
                        <option value="pending">Pending</option>
                        <option value="approved">Approved</option>
                        <option value="rejected">Rejected</option>
                    </select>
                }
            />

            {loading ? (
                <div className="p-12 text-center text-slate-500 flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                    <p>Loading applications...</p>
                </div>
            ) : filtered.length === 0 ? (
                <div className="bg-white rounded-2xl p-12 text-center border border-slate-100 shadow-sm">
                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
                        <Mail size={32} />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-800">No applications found</h3>
                    <p className="text-slate-500 text-sm">There are no {filter !== 'all' ? filter : ''} doctor applications at the moment.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {filtered.map(a => (
                        <motion.div
                            key={a._id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden"
                        >
                            <div className={`absolute top-0 right-0 px-3 py-1 text-xs font-bold rounded-bl-xl ${a.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                                a.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                                    'bg-red-100 text-red-700'
                                }`}>
                                {(a.status || 'pending').toUpperCase()}
                            </div>

                            <div className="flex items-start gap-4 mb-4">
                                <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-lg">
                                    {a.name?.charAt(0) || 'D'}
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-800 text-lg leading-tight">{a.name}</h3>
                                    <div className="text-sm text-slate-500">{a.email}</div>
                                </div>
                            </div>

                            <div className="space-y-2 text-sm text-slate-600 mb-6">
                                <div className="flex items-center gap-2">
                                    <Briefcase size={16} className="text-slate-400" />
                                    <span>{a.specialization || 'General'} • {a.department || 'N/A'}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <GraduationCap size={16} className="text-slate-400" />
                                    <span>{a.education || 'N/A'} • {a.yearsExperience || 0} Yrs Exp</span>
                                </div>
                                {a.address && (
                                    <div className="flex items-center gap-2">
                                        <MapPin size={16} className="text-slate-400" />
                                        <span className="truncate">{a.address}</span>
                                    </div>
                                )}
                                {a.message && (
                                    <div className="mt-3 bg-slate-50 p-3 rounded-lg text-xs italic text-slate-500">
                                        "{a.message}"
                                    </div>
                                )}
                            </div>

                            {a.status === 'pending' && (
                                <div className="flex gap-3 pt-4 border-t border-slate-100">
                                    <button
                                        onClick={() => reject(a._id)}
                                        className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 font-medium transition-colors"
                                    >
                                        <X size={16} /> Reject
                                    </button>
                                    <button
                                        onClick={() => approve(a._id)}
                                        className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 font-medium transition-colors shadow-sm shadow-emerald-200"
                                    >
                                        <Check size={16} /> Approve
                                    </button>
                                </div>
                            )}
                        </motion.div>
                    ))}
                </div>
            )}
        </PageContainer>
    );
}

