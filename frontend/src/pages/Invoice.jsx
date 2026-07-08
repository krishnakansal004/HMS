import { useProfileRender } from '../utils/profiler';
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getInvoice } from '../services/api'

export default function Invoice() {
    useProfileRender('Invoice', true);
    const { id } = useParams()
    const [invoice, setInvoice] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        getInvoice(id).then(setInvoice).finally(() => setLoading(false))
    }, [id])

    if (loading) return <div className="p-8 text-center">Loading invoice...</div>
    if (!invoice) return <div className="p-8 text-center text-red-500">Invoice not found</div>

    const printInvoice = () => window.print()

    // Heuristic fix for legacy Paise records vs new Rupee records
    const formatAmount = (amt) => {
        const val = Number(amt) || 0
        if (val > 50000) return (val / 100).toFixed(2)
        return val.toFixed(2)
    }

    // Fallback calculations if server did not provide (defensive). Amounts are in RUPEES.
    const rawSubtotal = invoice.subtotal ?? invoice.items.reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.unitPrice) || Number(i.medicine?.sellingPrice || 0) || 0), 0)
    const rawGst = invoice.gstTotal ?? invoice.items.reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.unitPrice) || Number(i.medicine?.sellingPrice || 0) || 0) * ((Number(i.gstRate) || Number(i.medicine?.gstRate) || 0) / 100), 0)
    const rawTotal = invoice.total ?? (rawSubtotal + rawGst)

    const computedSubtotal = formatAmount(rawSubtotal)
    const computedGst = formatAmount(rawGst)
    const computedTotal = formatAmount(rawTotal)

    const gstRateLabel = invoice.items && invoice.items.length && (invoice.items[0]?.gstRate ?? invoice.items[0]?.medicine?.gstRate)
        ? (invoice.items[0]?.gstRate ?? invoice.items[0]?.medicine?.gstRate)
        : (rawGst && rawSubtotal ? (((rawGst / (rawSubtotal || 1)) * 100).toFixed(2)) : 5)

    return (
        <>
            <div className="max-w-5xl mx-auto my-6 flex justify-end print-hidden">
                <button onClick={printInvoice} className="btn btn-primary">Print / Save PDF</button>
            </div>
            <div id="invoice-content" className="invoice-card mx-auto">
                <div className="invoice-inner">
                    {/* Top header section */}
                    <div className="flex justify-between">
                        <div className="space-y-2">
                            <div className="flex items-center gap-2">
                                <div className="w-6 h-6 bg-primary rounded-sm rotate-45" />
                                <h1 className="text-2xl font-semibold tracking-wide">HOSPITECHVERSE</h1>
                            </div>
                            <div className="text-sm leading-relaxed text-gray-700">
                                <div className="font-medium">HOSPITECHVERSE</div>
                                <div>123 Healthcare Lane,</div>
                                <div>Medical City, MC 12345</div>
                                <div>Email: info@hospitechverse.example</div>
                            </div>
                        </div>
                        <div className="text-sm text-gray-700 space-y-2 text-right">
                            <div className="flex justify-end gap-4">
                                <div className="font-semibold">Invoice Number:</div>
                                <div className="font-medium">{invoice.invoiceNumber || invoice._id}</div>
                            </div>
                            <div className="flex justify-end gap-4">
                                <div className="font-semibold">Date:</div>
                                <div>{new Date(invoice.createdAt).toLocaleString()}</div>
                            </div>
                            {invoice.doctorName && (
                                <div className="flex justify-end gap-4">
                                    <div className="font-semibold">Doctor:</div>
                                    <div className="font-medium">{(String(invoice.doctorName).toUpperCase().startsWith('DR') ? String(invoice.doctorName).toUpperCase() : `DR. ${String(invoice.doctorName).toUpperCase()}`)}</div>
                                </div>
                            )}
                        </div>
                    </div>
                    {/* Divider */}
                    <div className="h-px bg-gray-200 my-6" />
                    {/* Bill To */}
                    <div className="mb-6">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <div className="font-semibold text-sm mb-1">BILL TO</div>
                                <div className="text-sm text-gray-800 font-medium">{invoice.patientName}</div>
                                {invoice.patientAddress && <div className="text-sm text-gray-600">{invoice.patientAddress}</div>}
                            </div>
                            <div className="text-right">
                                {invoice.payment && (
                                    <div className="text-sm text-gray-700">
                                        <div className="font-semibold">Payment</div>
                                        <div>{invoice.payment.provider || ''} {invoice.payment.transactionId ? `Txn: ${invoice.payment.transactionId}` : ''}</div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    {/* Items table with headers */}
                    <table className="w-full text-sm border-collapse mb-4">
                        <thead>
                            <tr className="bg-gray-100 text-gray-700 text-xs uppercase tracking-wide">
                                <th className="font-semibold px-3 py-2 text-left">Description</th>
                                <th className="font-semibold px-3 py-2 text-center">Qty</th>
                                <th className="font-semibold px-3 py-2 text-right">Unit Price</th>
                                <th className="font-semibold px-3 py-2 text-right">Total</th>
                            </tr>
                        </thead>
                        <tbody className="align-top">
                            {invoice.items.map((item, i) => {
                                const medName = item.medicine?.name || item.description || 'Item'
                                const qty = Number(item.quantity) || 0
                                const unitRaw = Number(item.unitPrice) || Number(item.medicine?.sellingPrice) || 0
                                const lineTotalRaw = qty * unitRaw
                                return (
                                    <tr key={i} className="border-t">
                                        <td className="px-3 py-3 text-gray-800">{medName}</td>
                                        <td className="px-3 py-3 text-center">{qty}</td>
                                        <td className="px-3 py-3 text-right">₹{formatAmount(unitRaw)}</td>
                                        <td className="px-3 py-3 text-right font-medium">₹{formatAmount(lineTotalRaw)}</td>
                                    </tr>
                                )
                            })}
                            {/* Summary rows */}
                            <tr className="border-t">
                                <td colSpan={2} className="px-3 py-3" />
                                <td className="px-3 py-3 font-semibold text-right">Subtotal:</td>
                                <td className="px-3 py-3 text-right font-medium">₹{computedSubtotal}</td>
                            </tr>
                            <tr className="border-t">
                                <td colSpan={2} className="px-3 py-3" />
                                <td className="px-3 py-3 font-semibold text-right">GST ({gstRateLabel}%):</td>
                                <td className="px-3 py-3 text-right font-medium">₹{computedGst}</td>
                            </tr>
                            <tr className="border-t">
                                <td colSpan={2} className="px-3 py-3" />
                                <td className="px-3 py-3 font-semibold text-right">Total Amount</td>
                                <td className="px-3 py-3 text-right font-bold">₹{computedTotal}</td>
                            </tr>
                        </tbody>
                    </table>
                    <div className="text-center text-sm text-gray-600 mt-8">Thank you for your business!</div>
                </div>
            </div>
        </>
    )
}

