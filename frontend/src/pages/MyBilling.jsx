import { useProfileRender } from '../utils/profiler';
import { useState, useMemo } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { listMyInvoices, getInvoicePdf } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { CreditCard, Download, Eye, FileText } from 'lucide-react'
import PageContainer from '../components/Admin/PageContainer'
import PageHeader from '../components/Admin/PageHeader'
import { toast } from 'react-toastify'

export default function MyBilling() {
    useProfileRender('MyBilling', true);
    const navigate = useNavigate()
    const { user } = useAuth()
    const { hospitalSlug } = useParams()

    const { data, isLoading } = useQuery({
        queryKey: ['myInvoices'],
        queryFn: listMyInvoices,
    })

    const invoices = useMemo(() => Array.isArray(data) ? data : [], [data])
    const loading = isLoading

    const download = async (id) => {
        try {
            const blob = await getInvoicePdf(id)
            const url = URL.createObjectURL(blob); 
            const a = document.createElement('a'); 
            a.href = url; 
            a.download = `invoice-${id}.pdf`; 
            a.click();
        } catch (e) { toast.error('Download failed') }
    }

    // Heuristic fix for legacy Paise records vs new Rupee records
    const formatAmount = (amt) => {
        const val = Number(amt) || 0
        // If > 50,000 it is almost certainly a legacy scale error (Paise stored as Rupees)
        // given the context of this specific hospital app.
        if (val > 50000) return (val / 100).toFixed(2)
        return val.toFixed(2)
    }

    return (
        <PageContainer>
            <PageHeader title="My Billing" breadcrumbs={[{ label: 'Dashboard', to: '/' }, { label: 'Billing' }]} />

            <div className="max-w-4xl mx-auto">
                {/* HISTORY SECTION */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col min-h-[500px]">
                    <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                        <h2 className="font-bold text-slate-800 text-lg">Billing History</h2>
                        <span className="bg-white border border-slate-200 text-slate-600 text-xs font-bold px-2 py-1 rounded-md">{invoices.length}</span>
                    </div>

                    <div className="p-4 space-y-3">
                        {loading ? (
                            <div className="p-12 text-center text-slate-400">Loading history...</div>
                        ) : invoices.length === 0 ? (
                            <div className="p-20 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                                <FileText size={48} className="mx-auto text-slate-300 mb-3" />
                                <p className="text-slate-500 font-medium">No billing history found</p>
                            </div>
                        ) : invoices.map(inv => {
                            const rawTotal = inv.total || (inv.items || []).reduce((sum, item) => {
                                const price = item.unitPrice || 0;
                                const gstLabel = item.gstRate || 0;
                                return sum + (item.quantity * price * (1 + gstLabel / 100));
                            }, 0);

                            const invPath = hospitalSlug ? `/portal/${hospitalSlug}/invoice/${inv._id}` : `/invoice/${inv._id}`

                            return (
                                <div key={inv._id} className="p-4 rounded-xl border border-slate-100 hover:border-blue-200 hover:shadow-md transition-all bg-white group flex justify-between items-center">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shrink-0">
                                            <CreditCard size={24} />
                                        </div>
                                        <div>
                                            <div className="text-xs font-bold text-slate-400 uppercase tracking-wide">#{inv.invoiceNumber || 'INV-PENDING'}</div>
                                            <div className="font-bold text-slate-800 text-lg">₹{formatAmount(rawTotal)}</div>
                                            <div className="text-xs text-slate-500">{new Date(inv.createdAt).toLocaleDateString()} at {new Date(inv.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Link to={invPath} className="btn btn-sm btn-outline gap-1">
                                            <Eye size={14} /> View
                                        </Link>
                                        <button onClick={() => download(inv._id)} className="btn btn-sm btn-outline gap-1">
                                            <Download size={14} /> PDF
                                        </button>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>
        </PageContainer>
    )
}

