import { useProfileRender } from '../utils/profiler';

import { useEffect, useState } from 'react';
import { listQueries } from '../services/api';
import { toast } from 'react-toastify';
import { Mail, Phone, Clock, Search, MessageCircle, User } from 'lucide-react';
import { motion } from 'framer-motion';
import PageContainer from '../components/Admin/PageContainer'
import PageHeader from '../components/Admin/PageHeader'

export default function Queries() {
    useProfileRender('Queries', true);
    const [queries, setQueries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('')

    useEffect(() => {
        fetchQueries();
    }, []);

    const fetchQueries = async () => {
        try {
            const data = await listQueries();
            setQueries(data);
        } catch (error) {
            toast.error('Failed to load queries');
        } finally {
            setLoading(false);
        }
    };

    const filtered = queries.filter(q => {
        if (!search) return true
        return [q.name, q.email, q.subject, q.message].join(' ').toLowerCase().includes(search.toLowerCase())
    })

    return (
        <PageContainer>
            <PageHeader
                title="User Queries"
                breadcrumbs={[{ label: 'Dashboard', to: '/' }, { label: 'Queries' }]}
            />

            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col h-[calc(100vh-12rem)] md:h-auto overflow-hidden">
                <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                    <div className="relative max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                            placeholder="Search queries..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>
                </div>

                <div className="overflow-auto flex-1 p-6">
                    {loading ? (
                        <div className="text-center text-slate-500">Loading queries...</div>
                    ) : filtered.length === 0 ? (
                        <div className="text-center text-slate-500 py-12">
                            <MessageCircle size={48} className="mx-auto text-slate-200 mb-4" />
                            <p>No queries found.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                            {filtered.map((q, i) => (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.05 }}
                                    key={q._id}
                                    className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col h-full"
                                >
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                                                {(q.name || 'U')[0]}
                                            </div>
                                            <div>
                                                <div className="font-semibold text-slate-800">{q.name}</div>
                                                <div className="text-xs text-slate-500 flex items-center gap-1">
                                                    <Clock size={10} /> {new Date(q.createdAt).toLocaleDateString()}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-2 mb-4 flex-1">
                                        <div className="flex items-center gap-2 text-sm text-slate-600">
                                            <Mail size={14} className="text-slate-400" /> <a href={`mailto:${q.email}`} className="hover:text-blue-600 hover:underline">{q.email}</a>
                                        </div>
                                        {q.phone && (
                                            <div className="flex items-center gap-2 text-sm text-slate-600">
                                                <Phone size={14} className="text-slate-400" /> {q.phone}
                                            </div>
                                        )}
                                    </div>

                                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 relative">
                                        {q.subject && <div className="font-semibold text-sm text-slate-800 mb-1">{q.subject}</div>}
                                        <p className="text-sm text-slate-600 italic">"{q.message}"</p>
                                    </div>

                                    <div className="mt-4 pt-4 border-t border-slate-100 flex justify-end">
                                        <a
                                            href={`mailto:${q.email}?subject=Re: ${q.subject || 'Your Query'}`}
                                            className="text-sm font-medium text-blue-600 hover:text-blue-800 flex items-center gap-2"
                                        >
                                            <Mail size={16} /> Reply via Email
                                        </a>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </PageContainer>
    );
}

