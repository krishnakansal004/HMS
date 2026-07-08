import { useProfileRender } from '../utils/profiler';
import React, { useEffect, useMemo, useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { listInvoices, getInvoicePdf } from '../services/api'
import { FileText, Search, User, Download, Filter, RefreshCw } from 'lucide-react'
import PageContainer from '../components/Admin/PageContainer'
import PageHeader from '../components/Admin/PageHeader'
import { motion } from 'framer-motion'

const InvoiceRow = React.memo(({ inv, downloadPdf }) => {
    return (
        <tr className="hover:bg-slate-50/80 transition-colors group">
            <td className="px-6 py-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                        <FileText size={18} />
                    </div>
                    <div>
                        <div className="font-semibold text-slate-800">#{inv.invoiceNumber || inv._id.slice(-6)}</div>
                        <div className="text-xs text-slate-500 flex items-center gap-1">
                            By {inv.createdBy?.name || 'Unknown'}
                            <span className="px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 capitalize text-[10px]">{inv.createdByRole}</span>
                        </div>
                    </div>
                </div>
            </td>
            <td className="px-6 py-4 text-sm text-slate-600">
                {new Date(inv.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                <div className="text-xs text-slate-400">{new Date(inv.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
            </td>
            <td className="px-6 py-4">
                <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center text-xs font-bold">
                        {inv.patientName?.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-sm font-medium text-slate-700">{inv.patientName}</span>
                </div>
            </td>
            <td className="px-6 py-4 text-right text-sm text-slate-600">{inv.items?.length || 0}</td>
            <td className="px-6 py-4 text-right font-bold text-slate-800">₹{(Number(inv.total || 0)).toFixed(2)}</td>
            <td className="px-6 py-4 text-right">
                <button
                    className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    onClick={() => downloadPdf(inv._id)}
                    title="Download PDF"
                >
                    <Download size={18} />
                </button>
            </td>
        </tr>
    )
})

export default function BillManager() {
    useProfileRender('BillManager', true);
    const [page, setPage] = useState(1)
    const limit = 25
    const [q, setQ] = useState('')
    const [role, setRole] = useState('') // '', 'admin', 'patient', 'doctor'

    // TanStack Query caching & pagination
    const { data: rawInvoices, isLoading: loading, isFetching, refetch: fetchInvoices } = useQuery({
        queryKey: ['invoices', page],
        queryFn: () => listInvoices({ page, limit }),
        refetchInterval: 10000,        // auto-refresh every 10 s
        refetchOnWindowFocus: true,    // refresh when tab regains focus
    })

    const invoices = useMemo(() => {
        return Array.isArray(rawInvoices) ? rawInvoices : []
    }, [rawInvoices])

    const data = useMemo(() => {
        let rows = invoices
        if (q) {
            const s = q.toLowerCase()
            rows = rows.filter(r =>
                String(r.invoiceNumber || r._id).toLowerCase().includes(s) ||
                (r.patientName || '').toLowerCase().includes(s) ||
                (r.createdBy?.name || '').toLowerCase().includes(s)
            )
        }
        if (role) rows = rows.filter(r => (r.createdByRole || '') === role)
        return rows
    }, [invoices, q, role])

    const hasMore = invoices.length === limit

    const downloadPdf = useCallback(async (id) => {
        try {
            const blob = await getInvoicePdf(id)
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `invoice-${id}.pdf`
            document.body.appendChild(a)
            a.click()
            a.remove()
            URL.revokeObjectURL(url)
        } catch (e) { }
    }, [])

    return (
        <PageContainer>
            <PageHeader title="Bill Manager" breadcrumbs={[{ label: 'Dashboard', to: '/' }, { label: 'Invoices' }]} />

            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col h-[calc(100vh-12rem)] md:h-auto overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row gap-4 items-center bg-slate-50/50">
                    <div className="relative flex-1 w-full">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
                            placeholder="Search by Invoice #, Patient, or Creator..."
                            value={q}
                            onChange={e => setQ(e.target.value)}
                        />
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <Filter size={18} className="text-slate-400" />
                        <select
                            className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 font-medium text-slate-600 cursor-pointer hover:border-blue-300 transition-colors w-full sm:w-48"
                            value={role}
                            onChange={e => setRole(e.target.value)}
                        >
                            <option value="">All Roles</option>
                            <option value="admin">Admin</option>
                            <option value="doctor">Doctor</option>
                            <option value="patient">Patient</option>
                        </select>
                        <button
                            onClick={() => fetchInvoices()}
                            disabled={isFetching}
                            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-600 hover:border-blue-400 hover:text-blue-600 transition-all font-medium disabled:opacity-50"
                            title="Refresh invoices"
                        >
                            <RefreshCw size={15} className={isFetching ? 'animate-spin' : ''} />
                            Refresh
                        </button>
                    </div>
                </div>

                <div className="overflow-auto flex-1">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-50 sticky top-0 z-10 text-xs font-bold text-slate-500 uppercase tracking-wider">
                            <tr>
                                <th className="px-6 py-4">Invoice Info</th>
                                <th className="px-6 py-4">Date</th>
                                <th className="px-6 py-4">Patient</th>
                                <th className="px-6 py-4 text-right">Items</th>
                                <th className="px-6 py-4 text-right">Total</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {loading ? (
                                <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-500">Loading invoices...</td></tr>
                            ) : data.length === 0 ? (
                                <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-500">No invoices found.</td></tr>
                            ) : data.map((inv) => (
                                <InvoiceRow key={inv._id} inv={inv} downloadPdf={downloadPdf} />
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Controls */}
                <div className="p-4 border-t border-slate-100 flex items-center justify-between text-sm bg-slate-50/50">
                    <div className="text-slate-500">Page {page}</div>
                    <div className="flex gap-2">
                        <button 
                            className="btn btn-sm btn-ghost" 
                            onClick={() => setPage(p => Math.max(1, p - 1))} 
                            disabled={loading || page === 1}
                        >
                            Previous
                        </button>
                        <button 
                            className="btn btn-sm btn-ghost" 
                            onClick={() => setPage(p => p + 1)} 
                            disabled={loading || !hasMore}
                        >
                            Next
                        </button>
                    </div>
                </div>
            </div>
        </PageContainer>
    )
}

