import { useProfileRender } from '../../utils/profiler';
import React, { useState, useMemo, useCallback } from 'react'
import { useAuth } from '../../context/AuthContext'
import { listPlanReceipts, authFetch, API_BASE, getAuthToken, getPlanReceiptPdf } from '../../services/api'
import { FileText, Download, User, CheckCircle, Clock, Search } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'

export default function ReceiptsPage() {
    useProfileRender('ReceiptsPage', true);
    const { } = useAuth()
    const [q, setQ] = useState('')

    const { data: invoices = [], isLoading: loading, error: queryError } = useQuery({
        queryKey: ['planReceipts'],
        queryFn: listPlanReceipts
    })

    const error = queryError?.message

    const filtered = useMemo(() => {
        return invoices.filter(inv =>
            String(inv.invoiceNumber || '').toLowerCase().includes(q.toLowerCase()) ||
            (inv.billing?.name || '').toLowerCase().includes(q.toLowerCase()) ||
            (inv.billing?.email || '').toLowerCase().includes(q.toLowerCase())
        )
    }, [invoices, q])

    const handleDownload = useCallback(async (id, invoiceNumber) => {
        try {
            const blob = await getPlanReceiptPdf(id);
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `receipt-${invoiceNumber || id}.pdf`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
        } catch (e) {
            console.error(e);
            alert('Failed to download PDF. Please try again.');
        }
    }, [])

    return (
        <div className="p-4 md:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Receipts & Invoices</h1>
                    <p className="text-slate-500">Transaction history and downloadable invoices.</p>
                </div>
                <div className="relative w-full sm:w-72">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                        value={q}
                        onChange={e => setQ(e.target.value)}
                        placeholder="Search receipts..."
                        className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all shadow-sm"
                    />
                </div>
            </div>

            {error && <div className="p-4 bg-red-50 text-red-600 rounded-xl border border-red-100">{error}</div>}

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="table-responsive overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[1000px]">
                        <thead>
                            <tr className="bg-slate-50/50 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                <th className="px-6 py-4">Invoice Details</th>
                                <th className="px-6 py-4">Customer</th>
                                <th className="px-6 py-4 text-right">Amount</th>
                                <th className="px-6 py-4">Date</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            <AnimatePresence>
                                {loading ? (
                                    <tr><td colSpan={6} className="p-8 text-center text-slate-400">Loading...</td></tr>
                                ) : filtered.length === 0 ? (
                                    <tr><td colSpan={6} className="p-8 text-center text-slate-400">No receipts found.</td></tr>
                                ) : filtered.map((inv, i) => (
                                    <motion.tr
                                        key={inv._id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: i * 0.03 }}
                                        className="hover:bg-slate-50/80 transition-colors"
                                    >
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                                                    <FileText size={18} />
                                                </div>
                                                <div className="font-mono text-sm font-medium text-slate-700">
                                                    {inv.invoiceNumber || `#${inv._id.slice(-6).toUpperCase()}`}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-sm font-medium text-slate-800">{inv.billing?.name || 'Unknown'}</div>
                                            <div className="text-xs text-slate-500">{inv.billing?.email}</div>
                                        </td>
                                        <td className="px-6 py-4 text-right font-bold text-slate-700">
                                            ₹{((inv.total || 0) / 100).toFixed(2)}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-slate-500">
                                            {new Date(inv.createdAt).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4">
                                            {inv.paidAt ? (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600 text-xs font-bold border border-emerald-100">
                                                    <CheckCircle size={12} /> Paid
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-50 text-orange-600 text-xs font-bold border border-orange-100">
                                                    <Clock size={12} /> Pending
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button
                                                onClick={() => handleDownload(inv._id, inv.invoiceNumber)}
                                                className="text-slate-400 hover:text-indigo-600 transition-colors p-2 hover:bg-slate-100 rounded-lg"
                                                title="Download PDF"
                                            >
                                                <Download size={18} />
                                            </button>
                                        </td>
                                    </motion.tr>
                                ))}
                            </AnimatePresence>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
