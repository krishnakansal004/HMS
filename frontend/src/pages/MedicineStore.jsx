import { useProfileRender } from '../utils/profiler';
import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { listMedicines, createPaymentLink, createRazorpayOrder, verifyRazorpayPayment, getPrescription } from '../services/api'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'react-toastify'
import { Search, ShoppingCart, Pill, Package, AlertCircle, Loader2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../context/AuthContext'
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

export default function MedicineStore() {
    useProfileRender('MedicineStore', true);
    const location = useLocation()
    const navigate = useNavigate()
    const { hospitalSlug } = useParams()
    const { user } = useAuth()
    const [query, setQuery] = useState('')
    const [searchQuery, setSearchQuery] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [cart, setCart] = useState([]) // { medicine, qty }
    const [cartOpen, setCartOpen] = useState(false)
    const [prescriptionId, setPrescriptionId] = useState(null)
    const [hasPreFilled, setHasPreFilled] = useState(false)

    // Pre-fill search from ?q=... (coming from Prescriptions page "Buy" button)
    useEffect(() => {
        const params = new URLSearchParams(location.search)
        const q = params.get('q') || ''
        const pid = params.get('prescriptionId')
        if (q) {
            setQuery(q)
            setSearchQuery(q)
        }
        if (pid) setPrescriptionId(pid)
    }, [location.search])

    const { data: medsData, isLoading: medsLoading } = useQuery({
        queryKey: ['medicines', searchQuery],
        queryFn: () => listMedicines(searchQuery),
    })

    const medicines = useMemo(() => Array.isArray(medsData) ? medsData : [], [medsData])
    const loading = medsLoading

    const { data: prescription } = useQuery({
        queryKey: ['prescription', prescriptionId],
        queryFn: () => getPrescription(prescriptionId),
        enabled: !!prescriptionId,
    })

    const parseFrequencyPerDay = (f) => {
        if (!f) return 1;
        const lower = f.toLowerCase().trim();
        if (/^\d+(?:-\d+)+$/.test(lower)) return lower.split('-').reduce((s, p) => s + (parseInt(p, 10) || 0), 0);
        if (/^\d+$/.test(lower)) return parseInt(lower, 10);
        if (['od', 'daily', 'once'].includes(lower)) return 1;
        if (['bd', 'twice'].includes(lower)) return 2;
        if (['tid', 'thrice'].includes(lower)) return 3;
        if (['qid', 'four'].includes(lower)) return 4;
        const everyMatch = lower.match(/every\s*(\d+)\s*h/); if (everyMatch) { const h = parseInt(everyMatch[1], 10); return h ? Math.round(24 / h) : 1 }
        const qhMatch = lower.match(/q(\d+)h/); if (qhMatch) { const h = parseInt(qhMatch[1], 10); return h ? Math.round(24 / h) : 1 }
        return 1;
    }
    const parseDurationDays = (d) => {
        if (!d) return 1; const lower = d.toLowerCase().trim(); const weekMatch = lower.match(/(\d+)\s*week/); if (weekMatch) return parseInt(weekMatch[1], 10) * 7; const dayMatch = lower.match(/(\d+)\s*d(?:ay|ays)?/); if (dayMatch) return parseInt(dayMatch[1], 10); if (/^\d+$/.test(lower)) return parseInt(lower, 10); return 1
    }
    const parseTabletsPerDose = (dosage) => { if (!dosage) return 1; const match = dosage.trim().match(/^(\d+)/); if (match) return parseInt(match[1], 10) || 1; return 1 }

    useEffect(() => {
        if (prescriptionId && prescription && Array.isArray(prescription.medicines) && medicines.length > 0 && !hasPreFilled) {
            setHasPreFilled(true)
            const toAdd = []
            for (const it of prescription.medicines) {
                const match = medicines.find(m => 
                    (it.medicine && String(m._id) === String(it.medicine)) || 
                    (m.name.toLowerCase() === (it.name || '').toLowerCase())
                )
                if (match) {
                    const freq = parseFrequencyPerDay(it.frequency)
                    const dur = parseDurationDays(it.duration)
                    const dose = parseTabletsPerDose(it.dosage)
                    const qty = Math.max(1, freq * dur * dose)
                    toAdd.push({ medicine: match, qty })
                }
            }
            if (toAdd.length) {
                setCart(toAdd)
                setCartOpen(true)
                toast.info(`Added ${toAdd.length} medicines from prescription to cart`)
            }
        }
    }, [prescription, medicines, prescriptionId, hasPreFilled])

    const filtered = medicines

    const addToCart = (med) => {
        setCart(prev => {
            const existing = prev.find(c => c.medicine._id === med._id)
            if (existing) {
                return prev.map(c => c.medicine._id === med._id
                    ? { ...c, qty: Math.min(c.qty + 1, med.quantity) }
                    : c
                )
            }
            return [...prev, { medicine: med, qty: 1 }]
        })
        toast.success(`${med.name} added to cart`)
    }

    const removeFromCart = (id) => setCart(prev => prev.filter(c => c.medicine._id !== id))

    const totalAmount = cart.reduce((sum, c) => sum + (c.medicine.sellingPrice || 0) * c.qty, 0)
    const cartCount = cart.reduce((sum, c) => sum + c.qty, 0)

    const handleProceedToBuy = async () => {
        if (cart.length === 0) return
        setSubmitting(true)
        try {
            const payloadItems = cart.map(c => ({
                medicine: c.medicine._id,
                quantity: c.qty,
                unitPrice: Number(c.medicine.sellingPrice || 0),
                gstRate: Number(c.medicine.gstRate || 0)
            }))

            const patientName = user?.name || 'Customer'
            const patientEmail = user?.email || undefined

            const res = await createPaymentLink({ 
                patientName, 
                items: payloadItems, 
                email: patientEmail,
                prescriptionId 
            })
            
            if (res && res.shortUrl) {
                const orderResp = await createRazorpayOrder(res.paymentRequestId)
                await loadRazorpay()
                if (orderResp && orderResp.order && window.Razorpay) {
                    const order = orderResp.order
                    const options = {
                        key: orderResp.keyId || res.keyId,
                        amount: order.amount,
                        currency: order.currency || 'INR',
                        order_id: order.id,
                        name: 'Medicine Store',
                        description: `Payment for Medicines - ${patientName}`,
                        handler: async function (response) {
                            try {
                                const verify = await verifyRazorpayPayment(response)
                                if (verify && verify.success) {
                                    toast.success('Payment successful! Your receipt is ready.')
                                    setCart([])
                                    setCartOpen(false)
                                    if (verify.invoiceId) {
                                        if (hospitalSlug) navigate(`/portal/${hospitalSlug}/invoice/${verify.invoiceId}`)
                                        else navigate(`/invoice/${verify.invoiceId}`)
                                    }
                                } else {
                                    toast.error(verify.message || 'Payment verification failed')
                                }
                            } catch (e) {
                                toast.error('Verification failed')
                            }
                        },
                        prefill: { name: patientName, email: patientEmail },
                        theme: { color: '#4f46e5' }
                    }
                    const rzp = new window.Razorpay(options)
                    rzp.open()
                } else {
                    // Fallback to payment link if inline checkout fails
                    window.open(res.shortUrl, '_blank')
                    toast.info('Opening payment link in a new tab...')
                }
            } else {
                toast.error('Failed to initiate payment')
            }
        } catch (e) {
            console.error('Checkout error', e)
            toast.error(e.message || 'Payment failed to start')
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <PageContainer>
            <PageHeader
                title="Medicine Store"
                breadcrumbs={[{ label: 'Dashboard', to: '/' }, { label: 'Medicine Store' }]}
                actions={
                    <button
                        className="relative flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-medium shadow-sm hover:bg-indigo-700 transition-all"
                        onClick={() => setCartOpen(true)}
                    >
                        <ShoppingCart size={18} />
                        Cart
                        {cartCount > 0 && (
                            <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-xs font-bold flex items-center justify-center">
                                {cartCount}
                            </span>
                        )}
                    </button>
                }
            />

            {/* Search bar */}
            <div className="mb-6 flex gap-3">
                <div className="relative flex-1 max-w-lg">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                        className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-sm"
                        placeholder="Search medicines..."
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                    />
                </div>
                <button
                    onClick={() => setSearchQuery(query)}
                    className="px-5 py-2.5 bg-slate-800 text-white rounded-xl text-sm font-medium hover:bg-slate-900 transition-colors"
                >
                    Search
                </button>
            </div>

            {/* Grid of medicines */}
            {loading ? (
                <div className="text-center text-slate-500 py-20">Loading medicines...</div>
            ) : filtered.length === 0 ? (
                <div className="text-center py-20">
                    <Pill className="mx-auto text-slate-300 mb-4" size={48} />
                    <p className="text-slate-500">No medicines found.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filtered.map(med => {
                        const inCart = cart.find(c => c.medicine._id === med._id)
                        const outOfStock = (med.quantity || 0) <= 0
                        const expired = med.expiryDate && new Date(med.expiryDate) < new Date()
                        return (
                            <motion.div
                                key={med._id}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                className={`bg-white rounded-2xl border ${outOfStock || expired ? 'border-red-100 opacity-70' : 'border-slate-100'} shadow-sm p-5 flex flex-col gap-3 hover:shadow-md transition-shadow`}
                            >
                                <div className="flex items-start gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
                                        <Pill size={20} className="text-indigo-600" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="font-semibold text-slate-800 truncate">{med.name}</div>
                                        <div className="text-xs text-slate-500">Batch: {med.batchNumber || '—'}</div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-2 text-xs">
                                    <div className="bg-slate-50 rounded-lg p-2">
                                        <div className="text-slate-500">Price</div>
                                        <div className="font-bold text-slate-800">₹{Number(med.sellingPrice || 0).toFixed(2)}</div>
                                    </div>
                                    <div className="bg-slate-50 rounded-lg p-2">
                                        <div className="text-slate-500">Stock</div>
                                        <div className={`font-bold ${med.quantity <= (med.reorderLevel || 10) ? 'text-amber-600' : 'text-slate-800'}`}>
                                            {med.quantity} units
                                        </div>
                                    </div>
                                </div>

                                {expired && (
                                    <div className="flex items-center gap-1 text-xs text-red-600 bg-red-50 px-2 py-1 rounded-lg">
                                        <AlertCircle size={12} /> Expired
                                    </div>
                                )}

                                <button
                                    disabled={outOfStock || expired}
                                    onClick={() => addToCart(med)}
                                    className={`w-full py-2 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2
                                        ${outOfStock || expired
                                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                            : inCart
                                                ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
                                                : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm shadow-indigo-200'
                                        }`}
                                >
                                    <ShoppingCart size={15} />
                                    {outOfStock ? 'Out of Stock' : expired ? 'Expired' : inCart ? `In Cart (${inCart.qty})` : 'Add to Cart'}
                                </button>
                            </motion.div>
                        )
                    })}
                </div>
            )}

            {/* Cart Drawer */}
            <AnimatePresence>
                {cartOpen && (
                    <>
                        <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setCartOpen(false)} />
                        <motion.div
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                            className="fixed right-0 top-0 bottom-0 w-full max-w-sm bg-white shadow-2xl z-50 flex flex-col"
                        >
                            <div className="p-5 border-b border-slate-100">
                                <div className="flex items-center justify-between">
                                    <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                        <ShoppingCart size={20} className="text-indigo-600" />
                                        Your Cart ({cartCount} items)
                                    </h2>
                                    <button onClick={() => setCartOpen(false)} className="p-2 hover:bg-slate-100 rounded-full">✕</button>
                                </div>
                            </div>
                            <div className="flex-1 overflow-y-auto p-5 space-y-3">
                                {cart.length === 0 ? (
                                    <div className="text-center py-12 text-slate-400">
                                        <Package size={40} className="mx-auto mb-3 opacity-40" />
                                        Cart is empty
                                    </div>
                                ) : cart.map(({ medicine: m, qty }) => (
                                    <div key={m._id} className="flex items-center gap-3 bg-slate-50 rounded-xl p-3">
                                        <div className="w-9 h-9 bg-indigo-100 rounded-lg flex items-center justify-center">
                                            <Pill size={16} className="text-indigo-600" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="font-medium text-slate-800 text-sm truncate">{m.name}</div>
                                            <div className="text-xs text-slate-500">₹{Number(m.sellingPrice || 0).toFixed(2)} × {qty}</div>
                                        </div>
                                        <div className="text-sm font-bold text-slate-700">₹{(Number(m.sellingPrice || 0) * qty).toFixed(2)}</div>
                                        <button onClick={() => removeFromCart(m._id)} className="text-red-400 hover:text-red-600 ml-1">✕</button>
                                    </div>
                                ))}
                            </div>
                            {cart.length > 0 && (
                                <div className="p-5 border-t border-slate-100 space-y-3">
                                    <div className="flex justify-between text-base font-bold text-slate-800">
                                        <span>Total</span>
                                        <span>₹{totalAmount.toFixed(2)}</span>
                                    </div>
                                    <button
                                        onClick={handleProceedToBuy}
                                        disabled={submitting}
                                        className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm transition-colors shadow-sm shadow-indigo-200 flex items-center justify-center gap-2"
                                    >
                                        {submitting ? (
                                            <>
                                                <Loader2 size={16} className="animate-spin" />
                                                Processing...
                                            </>
                                        ) : (
                                            `Proceed to Buy (₹${totalAmount.toFixed(2)})`
                                        )}
                                    </button>
                                    <p className="text-center text-xs text-slate-400">Secure payment via Razorpay</p>
                                </div>
                            )}
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </PageContainer>
    )
}

