import { useProfileRender } from '../utils/profiler';
import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'

export default function PayInvoice() {
    useProfileRender('PayInvoice', true);
    const { id } = useParams()
    const navigate = useNavigate()
    const [invoice, setInvoice] = useState(null)
    const [loading, setLoading] = useState(true)
    const [paying, setPaying] = useState(false)

    useEffect(() => { load() }, [id])

    async function load() {
        setLoading(true)
        try {
            const res = await fetch(`/api/invoices/${id}`)
            if (!res.ok) throw new Error('Invoice not found')
            const data = await res.json()
            setInvoice(data)
        } catch (e) {
            console.error(e)
            toast.error('Failed to load invoice')
        } finally { setLoading(false) }
    }

    async function onPay() {
        if (!invoice) return
        setPaying(true)
        try {
            // Create a Razorpay payment link from this invoice and open the payment page
            const res = await fetch(`/api/payments/razorpay/create-link-from-invoice/${id}`, { method: 'POST' })
            if (!res.ok) {
                const err = await res.json().catch(() => ({}))
                throw new Error(err.error || 'Failed to create payment link')
            }
            const data = await res.json()
            const { shortUrl, linkId } = data
            if (!shortUrl) throw new Error('Payment link not returned')

            // Open Razorpay payment page in a new tab
            window.open(shortUrl, '_blank')
            toast.info('Payment page opened. After completing payment, this page will poll for confirmation.')

            // Poll for payment status (public check) for up to ~2 minutes
            const maxAttempts = 40
            const intervalMs = 3000
            let attempt = 0
            let paid = false
            while (attempt < maxAttempts && !paid) {
                await new Promise(r => setTimeout(r, intervalMs))
                try {
                    const chk = await fetch(`/api/payments/razorpay/check-public/${linkId}`)
                    if (!chk.ok) continue
                    const status = await chk.json()
                    if (status && status.paid) {
                        paid = true
                        break
                    }
                } catch (e) { /* ignore polling errors */ }
                attempt++
            }

            if (paid) {
                toast.success('Payment confirmed — receipt will be emailed shortly')
                navigate('/my-receipts')
            } else {
                toast.info('Payment not yet confirmed. If you completed payment, wait a moment and refresh the Receipts page.')
            }
        } catch (e) {
            console.error(e)
            toast.error('Payment failed: ' + (e.message || e))
        } finally { setPaying(false) }
    }

    if (loading) return <div className="p-6 bg-white border rounded">Loading...</div>
    if (!invoice) return <div className="p-6 bg-white border rounded">Invoice not found</div>

    return (
        <div className="max-w-3xl mx-auto p-6 bg-white border rounded">
            <h2 className="text-xl font-semibold">Invoice Payment</h2>
            <div className="mt-4">
                <div><strong>Invoice #</strong> {invoice.invoiceNumber || invoice._id}</div>
                <div><strong>Patient / Customer</strong> {invoice.patientName}</div>
                <div><strong>Date</strong> {new Date(invoice.createdAt).toLocaleString()}</div>
                <div className="mt-4">
                    <strong>Items</strong>
                    <ul className="list-disc list-inside text-sm mt-2">
                        {(invoice.items || []).map((it, idx) => (
                            <li key={idx}>{it.description || it.medicine?.name || 'Item'} — ₹{(Number(it.unitPrice) || 0).toFixed(2)} x {it.quantity || 1}</li>
                        ))}
                    </ul>
                </div>
                <div className="mt-4 text-lg font-semibold">Total: ₹{(Number(invoice.total) || 0).toFixed(2)}</div>
            </div>
            <div className="mt-6">
                <button disabled={invoice.paid || paying} onClick={onPay} className={`px-4 py-2 rounded ${invoice.paid ? 'bg-gray-400' : 'bg-emerald-600 text-white'}`}>{invoice.paid ? 'Paid' : (paying ? 'Processing...' : 'Pay')}</button>
            </div>
        </div>
    )
}

