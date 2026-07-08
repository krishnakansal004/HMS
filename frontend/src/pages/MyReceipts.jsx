import { useProfileRender } from '../utils/profiler';
import { useState, useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { listMyInvoices, getInvoicePdf } from '../services/api'
import { Calendar, Download, Eye, FileText, CheckCircle, Clock } from 'lucide-react'
import { toast } from 'react-toastify'
import PageContainer from '../components/Admin/PageContainer'
import PageHeader from '../components/Admin/PageHeader'

export default function MyReceipts() {
    useProfileRender('MyReceipts', true);
    const { hospitalSlug } = useParams()
    const [downloading, setDownloading] = useState(null)

    const { data, isLoading } = useQuery({
        queryKey: ['myInvoices'],
        queryFn: listMyInvoices,
    })

    const invoices = useMemo(() => Array.isArray(data) ? data : [], [data])
    const loading = isLoading

    async function downloadPdf(id, invoiceNumber) {
        try {
            setDownloading(id)
            const blob = await getInvoicePdf(id)
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `receipt-${invoiceNumber || id}.pdf`
            document.body.appendChild(a); a.click(); a.remove()
            window.URL.revokeObjectURL(url)
        } catch (e) { alert('Download failed') }
        finally { setDownloading(null) }
    }

    // Heuristic fix for legacy Paise records vs new Rupee records
    const formatAmount = (amt) => {
        const val = Number(amt) || 0
        if (val > 50000) return (val / 100).toFixed(2)
        return val.toFixed(2)
    }

    return (
        <PageContainer>
            <PageHeader title="My Receipts" breadcrumbs={[{ label: 'Dashboard', to: '/' }, { label: 'Receipts' }]} />

            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-100">
                            <tr>
                                <th className="px-6 py-4">Invoice #</th>
                                <th className="px-6 py-4">Date</th>
                                <th className="px-6 py-4">Items</th>
                                <th className="px-6 py-4">Total</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {loading ? (
                                <tr><td colSpan={6} className="p-12 text-center text-slate-500">Loading receipts...</td></tr>
                            ) : invoices.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="p-12 text-center text-slate-500">
                                        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                            <FileText size={24} className="text-slate-400" />
                                        </div>
                                        No receipts found.
                                    </td>
                                </tr>
                             ) : invoices.map(inv => {
                                const total = inv.total || (inv.items || []).reduce((s, i) => {
                                    const qty = Number(i.quantity) || 0
                                    const unit = Number(i.unitPrice) || Number(i.medicine?.sellingPrice) || 0
                                    const gst = Number(i.gstRate || i.medicine?.gstRate || 0) / 100
                                    return s + (qty * unit * (1 + gst))
                                }, 0)
                                return (
                                    <tr key={inv._id} className="hover:bg-slate-50/50 transition-colors group">
                                        <td className="px-6 py-4 font-mono text-slate-600 text-xs font-bold">
                                            #{inv.invoiceNumber || inv._id.slice(-6).toUpperCase()}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2 text-slate-700 font-medium">
                                                <Calendar size={14} className="text-slate-400" />
                                                {new Date(inv.createdAt).toLocaleDateString()}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-slate-600 max-w-xs truncate">
                                            {inv.items?.map(i => i.description || i.medicine?.name).join(', ') || 'Medical Services'}
                                        </td>
                                        <td className="px-6 py-4 font-bold text-slate-800">
                                            ₹{formatAmount(total)}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-100">
                                                <CheckCircle size={12} /> Paid
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <Link
                                                    to={hospitalSlug ? `/portal/${hospitalSlug}/invoice/${inv._id}` : `/invoice/${inv._id}`}
                                                    className="btn btn-sm btn-outline gap-1"
                                                >
                                                    <Eye size={14} /> View
                                                </Link>
                                                <button
                                                    onClick={() => downloadPdf(inv._id, inv.invoiceNumber)}
                                                    disabled={downloading === inv._id}
                                                    className="btn btn-sm btn-outline gap-1"
                                                >
                                                    <Download size={14} /> {downloading === inv._id ? '...' : 'PDF'}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </PageContainer>
    )
}

