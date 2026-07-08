import React from 'react'
import { API_BASE, getAuthToken, getPlanReceiptPdf } from '../services/api'

export default function RenewHistoryModal({ open, onClose, tenant, receipts = [], apiBase = '', token = '' }) {
    if (!open) return null
    const list = (receipts || []).filter(r => {
        try {
            const company = r.billing && r.billing.company ? String(r.billing.company).toLowerCase() : null
            const email = r.billing && r.billing.email ? String(r.billing.email).toLowerCase() : null
            const dirEmail = tenant && tenant.director && tenant.director.email ? String(tenant.director.email).toLowerCase() : null
            if (company && tenant && company === String((tenant.name || '').toLowerCase())) return true
            if (email && dirEmail && email === dirEmail) return true
        } catch (e) { }
        return false
    }).sort((a, b) => new Date(b.paidAt || b.createdAt).getTime() - new Date(a.paidAt || a.createdAt).getTime())

    return (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
            <div className="bg-white rounded shadow p-6 w-full max-w-2xl max-h-[80vh] overflow-auto">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">Renew / Upgrade History — {tenant?.name || ''}</h3>
                    <button onClick={() => onClose(false)} className="px-2 py-1 rounded bg-gray-100">Close</button>
                </div>
                {list.length === 0 && <div className="text-sm text-gray-600">No renewals or upgrades found.</div>}
                {list.map(r => (
                    <div key={r._id} className="border-b py-3">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-sm font-medium">{r.billing?.company || r.billing?.name || 'Customer'}</div>
                                <div className="text-xs text-gray-600">{r.billing?.email || ''}</div>
                            </div>
                            <div className="text-sm">₹{typeof r.total !== 'undefined' ? (Number(r.total) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'} </div>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">{new Date(r.paidAt || r.createdAt).toLocaleString()}</div>
                        <div className="mt-2 text-xs">
                            {r.initiatedBy ? (<span>By: {r.initiatedBy.name || r.initiatedBy.email} </span>) : null}
                            <a 
                                href="#" 
                                onClick={async (e) => {
                                    e.preventDefault();
                                    try {
                                        const blob = await getPlanReceiptPdf(r._id);
                                        const url = window.URL.createObjectURL(blob);
                                        const a = document.createElement('a');
                                        a.href = url;
                                        a.download = `receipt-${r.invoiceNumber || r._id}.pdf`;
                                        document.body.appendChild(a);
                                        a.click();
                                        a.remove();
                                        window.URL.revokeObjectURL(url);
                                    } catch (err) {
                                        console.error(err);
                                        alert('Failed to download PDF');
                                    }
                                }}
                                className="ml-3 text-blue-600 hover:underline cursor-pointer"
                            >
                                PDF
                            </a>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
