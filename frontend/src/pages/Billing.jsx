import { useProfileRender } from '../utils/profiler';
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Search, ShoppingCart, CreditCard, User, Mail, Plus, Minus, Trash2, Tag, Receipt, XCircle } from 'lucide-react'
import { listMedicines, createInvoice, createPaymentLink, checkPaymentLink, createRazorpayOrder, verifyRazorpayPayment } from '../services/api'
import QRCode from 'qrcode'
import { toast } from 'react-toastify'
import { motion, AnimatePresence } from 'framer-motion'
import PageContainer from '../components/Admin/PageContainer'
import PageHeader from '../components/Admin/PageHeader'

// Helper to load Razorpay script dynamically if missing
function loadRazorpay() {
    return new Promise((resolve) => {
        if (window.Razorpay) return resolve(true)
        const script = document.createElement('script')
        script.src = 'https://checkout.razorpay.com/v1/checkout.js'
        script.onload = () => resolve(true)
        script.onerror = () => resolve(false)
        document.body.appendChild(script)
    })
}

export default function Billing() {
    useProfileRender('Billing', true);
    const navigate = useNavigate()
    const [q, setQ] = useState('')
    const [patientName, setPatientName] = useState('')
    const [patientEmail, setPatientEmail] = useState('')
    const [items, setItems] = useState([])
    const [submitting, setSubmitting] = useState(false)

    const { data: rawMedicines, isLoading: loading } = useQuery({
        queryKey: ['medicines', 'billing'],
        queryFn: () => listMedicines()
    })

    const all = useMemo(() => rawMedicines || [], [rawMedicines])

    const list = useMemo(() => {
        const lower = q.toLowerCase()
        const today = new Date(); today.setHours(0, 0, 0, 0)
        return all.map(m => {
            const cartItem = items.find(i => i.medicine === m._id)
            const remainingQty = (m.quantity || 0) - (cartItem?.quantity || 0)
            return { ...m, remainingQuantity: remainingQty }
        }).filter(m => {
            const exp = m.expiryDate ? new Date(m.expiryDate) : null
            const notExpired = !exp || exp >= today
            const hasStock = m.remainingQuantity > 0
            return notExpired && hasStock && m.name.toLowerCase().includes(lower)
        })
    }, [all, q, items])

    const addToCart = (m) => {
        const existing = items.find(i => i.medicine === m._id)
        if (existing) {
            if (existing.quantity >= m.quantity) {
                toast.warn(`Max stock reached for ${m.name}`)
                return
            }
            setItems(items.map(i => i.medicine === m._id ? { ...i, quantity: Math.min(i.quantity + 1, m.quantity) } : i))
        } else {
            setItems([...items, { medicine: m._id, quantity: 1, unitPrice: Number(m.sellingPrice || 0), gstRate: Number(m.gstRate || 0), name: m.name, maxQty: m.quantity }])
        }
    }
    const updateQty = (id, qty, max) => setItems(items.map(i => i.medicine === id ? { ...i, quantity: Math.max(1, Math.min(qty, max)) } : i))
    const removeItem = (id) => setItems(items.filter(i => i.medicine !== id))

    const subtotal = items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0)
    const gstTotal = items.reduce((sum, i) => sum + i.quantity * i.unitPrice * (i.gstRate / 100), 0)
    const total = subtotal + gstTotal

    const [payLink, setPayLink] = useState(null)
    const [qrDataUrl, setQrDataUrl] = useState('')
    const [checking, setChecking] = useState(false)

    const submit = async () => {
        setSubmitting(true)
        try {
            const payloadItems = items.map(i => ({ medicine: i.medicine, quantity: i.quantity, unitPrice: i.unitPrice, gstRate: i.gstRate }))
            const res = await createPaymentLink({ patientName, items: payloadItems, email: patientEmail || undefined })
            if (res && res.shortUrl) {
                if (res.keyId && !String(res.keyId).startsWith('rzp_test_')) {
                    toast.warn(`Razorpay key in use is not a test key: ${res.keyId}`)
                }
                try {
                    const orderResp = await createRazorpayOrder(res.paymentRequestId)
                    await loadRazorpay()
                    if (orderResp && orderResp.order && window.Razorpay) {
                        const order = orderResp.order
                        const keyId = orderResp.keyId || res.keyId
                        const options = {
                            key: keyId,
                            amount: order.amount,
                            currency: order.currency || 'INR',
                            order_id: order.id,
                            name: import.meta.env.VITE_COMPANY_NAME || (window?.ChatbotWidgetConfig?.companyName) || 'HOSPITECHVERSE',
                            description: `Payment for ${patientName}`,
                            handler: async function (response) {
                                try {
                                    const verify = await verifyRazorpayPayment(response)
                                    if (verify && verify.success) {
                                        toast.success('Payment verified; invoice generated')
                                        if (verify.invoiceId) navigate(`/invoice/${verify.invoiceId}`)
                                        setPayLink(null); setQrDataUrl(''); setItems([]); setPatientName('')
                                    } else {
                                        toast.error(verify.message || 'Payment verification failed')
                                    }
                                } catch (e) {
                                    toast.error(e.message || 'Verification failed')
                                }
                            },
                            prefill: { name: patientName || 'Customer', email: patientEmail || undefined },
                            theme: { color: '#5942ff' }
                        }
                        try {
                            const rzp = new window.Razorpay(options)
                            rzp.open()
                        } catch (err) {
                            console.error('Razorpay checkout open error', err)
                            try { window.open(res.shortUrl, '_blank') } catch (_) { }
                        }
                    } else {
                        try { window.open(res.shortUrl, '_blank') } catch (_) { }
                        setPayLink({ linkId: res.linkId, shortUrl: res.shortUrl, paymentRequestId: res.paymentRequestId, total, keyId: res.keyId })
                        const dataUrl = await QRCode.toDataURL(res.shortUrl)
                        setQrDataUrl(dataUrl)
                    }
                } catch (err) {
                    console.error('create order or checkout failed', err)
                    try { window.open(res.shortUrl, '_blank') } catch (_) { }
                    setPayLink({ linkId: res.linkId, shortUrl: res.shortUrl, paymentRequestId: res.paymentRequestId, total, keyId: res.keyId })
                    const dataUrl = await QRCode.toDataURL(res.shortUrl)
                    setQrDataUrl(dataUrl)
                }
            } else {
                toast.error('Failed to create payment link')
            }
        } catch (e) {
            toast.error(e.message || 'Failed to create payment link')
        } finally { setSubmitting(false) }
    }

    // Poll payment status
    useEffect(() => {
        if (!payLink || !payLink.linkId) return
        let canceled = false
        setChecking(true)
        const iv = setInterval(async () => {
            try {
                const st = await checkPaymentLink(payLink.linkId)
                if (st && st.paid) {
                    clearInterval(iv)
                    setChecking(false)
                    setPayLink(null)
                    setQrDataUrl('')
                    setItems([]); setPatientName('')
                    toast.success('Payment received; invoice generated')
                    if (st.invoiceId) navigate(`/invoice/${st.invoiceId}`)
                }
            } catch (err) { }
            if (canceled) { clearInterval(iv); setChecking(false) }
        }, 3000)
        return () => { canceled = true; clearInterval(iv); setChecking(false) }
    }, [payLink])

    return (
        <PageContainer>
            <PageHeader title="New Billing" breadcrumbs={[{ label: 'Dashboard', to: '/' }, { label: 'Billing' }]} />

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:h-[calc(100vh-10rem)] h-auto">
                {/* Product Search & List */}
                <div className="lg:col-span-7 flex flex-col gap-4 bg-white rounded-2xl shadow-sm border border-slate-100 p-4 h-full overflow-hidden">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                            className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium placeholder-slate-400"
                            placeholder="Search medicines to add..."
                            value={q}
                            onChange={e => setQ(e.target.value)}
                        />
                    </div>

                    <div className="flex-1 overflow-y-auto pr-2 space-y-2">
                        {loading ? (
                            <div className="p-8 text-center text-slate-500 animate-pulse">Loading medicines...</div>
                        ) : list.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-48 text-slate-400">
                                <Search size={32} className="mb-2 opacity-50" />
                                <p>No medicines found</p>
                            </div>
                        ) : (
                            list.map(m => (
                                <motion.button
                                    key={m._id}
                                    whileHover={{ scale: 1.01 }}
                                    whileTap={{ scale: 0.99 }}
                                    onClick={() => addToCart(m)}
                                    className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-white hover:border-blue-200 hover:shadow-sm transition-all text-left group"
                                >
                                    <div>
                                        <div className="font-semibold text-slate-800 group-hover:text-blue-700 transition-colors">{m.name}</div>
                                        <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                                            <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 font-medium">Batch: {m.batchNumber}</span>
                                            <span>Stock: {m.remainingQuantity}</span>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="font-bold text-slate-800">₹{Number(m.sellingPrice || 0).toFixed(2)}</div>
                                        <div className="text-[10px] text-slate-400">GST {m.gstRate}%</div>
                                    </div>
                                </motion.button>
                            ))
                        )}
                    </div>
                </div>

                {/* Cart & Billing Info */}
                <div className="lg:col-span-5 flex flex-col bg-white rounded-2xl shadow-sm border border-slate-100 h-full overflow-hidden">
                    <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                        <h2 className="font-bold text-slate-800 flex items-center gap-2">
                            <ShoppingCart size={18} className="text-blue-600" /> Current Invoice
                        </h2>
                    </div>

                    <div className="p-4 space-y-3 border-b border-slate-100">
                        <div className="relative">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                            <input
                                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                                placeholder="Patient Name *"
                                value={patientName}
                                onChange={e => setPatientName(e.target.value)}
                                required
                            />
                        </div>
                        <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                            <input
                                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                                placeholder="Email (Optional)"
                                value={patientEmail}
                                onChange={e => setPatientEmail(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        <AnimatePresence>
                            {items.length === 0 ? (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="h-full flex flex-col items-center justify-center text-slate-400 text-center"
                                >
                                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-3">
                                        <ShoppingCart size={24} className="opacity-50" />
                                    </div>
                                    <p className="text-sm font-medium">Cart is empty</p>
                                    <p className="text-xs">Select medicines to proceed.</p>
                                </motion.div>
                            ) : (
                                items.map(i => (
                                    <motion.div
                                        key={i.medicine}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-xl shadow-sm"
                                    >
                                        <div className="flex-1 min-w-0 mr-3">
                                            <div className="font-medium text-slate-800 truncate">{i.name}</div>
                                            <div className="text-xs text-slate-500">₹{i.unitPrice} × {i.quantity} (+{i.gstRate}%)</div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
                                                <button
                                                    className="p-1 px-2 hover:bg-slate-200 active:bg-slate-300 transition-colors"
                                                    onClick={() => updateQty(i.medicine, i.quantity - 1, i.maxQty)}
                                                >
                                                    <Minus size={12} />
                                                </button>
                                                <span className="w-8 text-center text-xs font-semibold">{i.quantity}</span>
                                                <button
                                                    className="p-1 px-2 hover:bg-slate-200 active:bg-slate-300 transition-colors"
                                                    onClick={() => updateQty(i.medicine, i.quantity + 1, i.maxQty)}
                                                >
                                                    <Plus size={12} />
                                                </button>
                                            </div>
                                            <button
                                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                onClick={() => removeItem(i.medicine)}
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </motion.div>
                                ))
                            )}
                        </AnimatePresence>
                    </div>

                    <div className="p-4 bg-slate-50 border-t border-slate-200">
                        <div className="space-y-1 mb-4 text-sm">
                            <div className="flex justify-between text-slate-600"><span>Subtotal</span><span>₹{subtotal.toFixed(2)}</span></div>
                            <div className="flex justify-between text-slate-600"><span>Tax (GST)</span><span>₹{gstTotal.toFixed(2)}</span></div>
                            <div className="flex justify-between text-slate-800 font-bold text-lg pt-2 border-t border-slate-200 mt-2"><span>Total</span><span>₹{total.toFixed(2)}</span></div>
                        </div>

                        {!payLink ? (
                            <button
                                className="w-full py-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled={items.length === 0 || submitting || !patientName}
                                onClick={submit}
                            >
                                {submitting ? (
                                    <>Processing...</>
                                ) : (
                                    <>
                                        <CreditCard size={18} /> Proceed to Pay
                                    </>
                                )}
                            </button>
                        ) : (
                            <div className="bg-white p-3 rounded-xl border border-blue-100 shadow-sm animate-in fade-in slide-in-from-bottom-2">
                                <div className="text-center mb-3">
                                    <div className="font-bold text-slate-800 mb-1">Payment Pending</div>
                                    <div className="text-xs text-slate-500">Scan QR or use link</div>
                                </div>
                                {qrDataUrl && (
                                    <div className="flex justify-center mb-3">
                                        <img src={qrDataUrl} alt="QR" className="w-32 h-32 border rounded-lg" />
                                    </div>
                                )}
                                <div className="grid grid-cols-2 gap-2">
                                    <button className="py-2 px-3 text-xs bg-slate-100 hover:bg-slate-200 rounded-lg font-medium transition-colors" onClick={() => { setPayLink(null); setQrDataUrl('') }}>Cancel</button>
                                    <a
                                        href={payLink.shortUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="py-2 px-3 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors text-center flex items-center justify-center gap-1"
                                    >
                                        Pay Link
                                    </a>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </PageContainer>
    )
}

