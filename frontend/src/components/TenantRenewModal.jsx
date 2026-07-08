import React, { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { getMyTenant } from '../services/api'

export default function TenantRenewModal({ open, onClose, tenant }) {
    const { token } = useAuth()
    const [period, setPeriod] = useState('monthly')
    const [amount, setAmount] = useState(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)
    const [accessCode, setAccessCode] = useState('')
    const [accessValidated, setAccessValidated] = useState(false)

    useEffect(() => {
        if (!open) return
        computeAmount(period)
        setAccessCode('')
        setAccessValidated(false)
    }, [open])

    function computeAmount(p) {
        try {
            setError(null)
            if (!tenant || !tenant.plan) return setAmount(null)
            const plan = tenant.plan
            // plan.prices are stored in cents
            const prices = plan.prices || {}
            let cents = 0
            switch ((p || '').toLowerCase()) {
                case '3months': cents = prices.threeMonths || 0; break
                case 'yearly': cents = prices.year || prices.yearly || 0; break
                case '5years': cents = prices.fiveYears || 0; break
                default: cents = prices.month || 0; break
            }
            // fallback compute from month price
            if (!cents) {
                const base = prices.month || 0
                if (base) {
                    if (p === '3months') cents = base * 3
                    else if (p === 'yearly') cents = base * 12
                    else if (p === '5years') cents = base * 60
                    else cents = base
                }
            }
            setAmount(cents ? (cents / 100).toFixed(2) : null)
        } catch (e) { setError('Failed to compute amount') }
    }

    async function proceed() {
        if (!tenant) return
        setLoading(true)
        setError(null)
        try {
            const API_BASE = (typeof import.meta !== 'undefined' && import.meta.env && typeof import.meta.env.VITE_API_URL !== 'undefined')
                ? (import.meta.env.VITE_API_URL || '')
                : ''
            const bodyPayload = { tenantId: tenant._id || tenant.id, period }
            if (tenant && tenant.plan && tenant.plan.customized) bodyPayload.accessCode = accessCode || undefined
            const res = await fetch(`${API_BASE}/api/plan-requests/renew`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(bodyPayload) })
            if (!res.ok) {
                const j = await res.json().catch(() => ({ error: 'Failed' }))
                throw new Error(j && j.error ? j.error : 'Failed to create renewal')
            }
            const data = await res.json()
            if (data && data.paymentShortUrl) {
                window.location.href = data.paymentShortUrl;
                return;
            }
            const linkId = data && data.paymentLinkId
            if (linkId) {
                // poll check-public for up to 2 minutes
                const checkUrl = `${API_BASE}/api/payments/razorpay/check-public/${linkId}`
                let paid = false
                const start = Date.now()
                while (Date.now() - start < 2 * 60 * 1000) {
                    // eslint-disable-next-line no-await-in-loop
                    await new Promise(r => setTimeout(r, 4000))
                    try {
                        // eslint-disable-next-line no-await-in-loop
                        const ch = await fetch(checkUrl)
                        if (!ch.ok) continue
                        const chj = await ch.json()
                        if (chj && chj.paid) { paid = true; break }
                    } catch (e) { }
                }
                if (paid) {
                    alert('Payment completed — subscription renewed.')
                    onClose(true)
                    return
                }
                alert('Payment link created. Complete payment in the opened tab. It may take a short while to process.')
                onClose(true)
                return
            }
            alert('Payment link created. Complete payment in the opened tab.')
            onClose(true)
        } catch (e) {
            console.error(e)
            setError(e.message || 'Failed')
        } finally { setLoading(false) }
    }

    if (!open) return null

    return (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
            <div className="bg-white rounded shadow p-6 w-full max-w-md">
                <h2 className="text-lg font-semibold mb-2">Renew Subscription</h2>
                <div className="text-sm text-gray-700 mb-4">Plan: <strong>{tenant && tenant.plan ? tenant.plan.name : '-'}</strong></div>
                <div className="mb-4">
                    <label className="block text-sm mb-1">Select period</label>
                    <select value={period} onChange={e => { setPeriod(e.target.value); computeAmount(e.target.value) }} className="w-full border rounded px-2 py-1">
                        <option value="monthly">Monthly</option>
                        <option value="3months">3 Months</option>
                        <option value="yearly">Yearly</option>
                        <option value="5years">5 Years</option>
                    </select>
                </div>
                <div className="mb-4">Amount: <strong>{amount ? `₹${amount}` : '—'}</strong></div>
                {tenant && tenant.plan && tenant.plan.customized && (
                    <div className="mb-3">
                        <label className="block text-sm mb-1">Access code (required for customized plans)</label>
                        <div className="flex gap-2">
                            <input value={accessCode} onChange={e => { setAccessCode(e.target.value); setAccessValidated(false) }} className="flex-1 px-3 py-2 border rounded" placeholder="Access code" />
                            <button onClick={async () => {
                                setError(null)
                                try {
                                    const res = await fetch(`${API_BASE}/api/plans/validate-access`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ planId: tenant.plan._id || tenant.plan.id, code: accessCode }) })
                                    if (!res.ok) {
                                        const j = await res.json().catch(() => ({ error: 'Invalid code' }))
                                        throw new Error(j && j.error ? j.error : 'Invalid code')
                                    }
                                    setAccessValidated(true)
                                } catch (e) { setError(e.message || 'Invalid access code') }
                            }} className="px-3 py-1 bg-gray-200 rounded">Validate</button>
                        </div>
                        {accessValidated && <div className="text-xs text-green-600 mt-1">Access code validated</div>}
                    </div>
                )}
                {error && <div className="text-red-600 mb-2">{error}</div>}
                <div className="flex justify-end gap-2">
                    <button onClick={() => onClose(false)} className="px-3 py-1 border rounded">Cancel</button>
                    <button onClick={proceed} disabled={loading || !amount} className={`px-3 py-1 rounded text-white ${loading || !amount ? 'bg-gray-400' : 'bg-green-600'}`}>{loading ? 'Processing...' : 'Proceed to Payment'}</button>
                </div>
            </div>
        </div>
    )
}
