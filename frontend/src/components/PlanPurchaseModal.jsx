// import React, { useState } from 'react'
// import { toast } from 'react-toastify'
// import { X, CreditCard, ShieldCheck, CheckCircle, Lock } from 'lucide-react'

// export default function PlanPurchaseModal({ plan, open, onClose }) {
//     const [customerName, setCustomerName] = useState('')
//     const [customerEmail, setCustomerEmail] = useState('')
//     const [countryCode, setCountryCode] = useState('+91')
//     const [customerPhone, setCustomerPhone] = useState('')
//     const [address, setAddress] = useState('')
//     const [description, setDescription] = useState('')
//     const [company, setCompany] = useState('')
//     const [period, setPeriod] = useState('monthly')
//     const [agree, setAgree] = useState(false)
//     const [file, setFile] = useState(null)
//     const [loading, setLoading] = useState(false)
//     const [accessCode, setAccessCode] = useState('')
//     const [accessValidated, setAccessValidated] = useState(false)
//     const [accessError, setAccessError] = useState(null)

//     if (!open) return null

//     const displayAmount = (() => {
//         const amt = computeAmountForPeriod(plan, period)
//         return (amt && !isNaN(amt)) ? `₹${(amt / 100).toLocaleString('en-IN')}` : '—'
//     })()

//     function computeAmountForPeriod(plan, period) {
//         // If this is a customized plan with explicit durations, prefer those prices
//         if (plan && plan.customized && Array.isArray(plan.durations) && plan.durations.length > 0) {
//             const wanted = (() => {
//                 switch ((period || 'monthly')) {
//                     case '3months': return { unit: 'months', length: 3 }
//                     case 'yearly': return { unit: 'years', length: 1 }
//                     case '5years': return { unit: 'years', length: 5 }
//                     default: return { unit: 'months', length: 1 }
//                 }
//             })()
//             const found = plan.durations.find(d => d.unit === wanted.unit && Number(d.length) === wanted.length)
//             if (found && typeof found.price !== 'undefined') return Number(found.price)
//         }
//         if (!plan || !plan.prices) return 0
//         const prices = plan.prices || {}
//         let amt = 0
//         switch ((period || 'monthly')) {
//             case '3months': amt = prices.threeMonths || 0; break
//             case 'yearly': amt = prices.year || prices.yearly || 0; break
//             case '5years': amt = prices.fiveYears || 0; break
//             default: amt = prices.month || 0
//         }
//         if (!amt) {
//             const base = prices.month || 0
//             if (base) {
//                 if (period === '3months') amt = base * 3
//                 else if (period === 'yearly') amt = base * 12
//                 else if (period === '5years') amt = base * 60
//                 else amt = base
//             }
//         }
//         return Number(amt || 0)
//     }

//     async function submit(e) {
//         e.preventDefault()
//         if (!agree) return toast.error('You must agree to terms')
//         if (!customerName || !customerEmail) return toast.error('Name and email required')
//         setLoading(true)
//         try {
//             const fd = new FormData()
//             fd.append('planName', plan?.name || '')
//             if (plan?._id) fd.append('planId', plan._id)
//             fd.append('customerName', customerName)
//             fd.append('customerEmail', customerEmail)
//             fd.append('customerCountryCode', countryCode)
//             fd.append('customerPhone', customerPhone)
//             fd.append('address', address)
//             fd.append('description', description)
//             fd.append('company', company)
//             fd.append('period', period)
//             // include computed amount (in paise) so frontend and backend are consistent
//             const amount = computeAmountForPeriod(plan, period)
//             fd.append('amount', String(amount))
//             fd.append('agreed', agree ? 'true' : 'false')
//             if (file) fd.append('idDocument', file, file.name)

//             // Call the new public endpoint which creates the PlanRequest, invoice and a payment link
//             const res = await fetch('/api/plan-requests/pay', { method: 'POST', body: fd })
//             let data
//             try {
//                 data = await res.json()
//             } catch (err) {
//                 console.error('Failed to parse response', err)
//                 throw new Error('Server returned an invalid response. Please contact support.')
//             }

//             if (!res.ok) {
//                 throw new Error(data.error || data.detail || 'Failed to initiate payment')
//             }

//             // If server indicates a non-test Razorpay key, block payment to enforce test-mode only
//             if (data.keyId && !String(data.keyId).startsWith('rzp_test_')) {
//                 toast.error('Payments are restricted to Razorpay test mode. Please contact administrator.')
//                 onClose && onClose(data)
//                 setLoading(false)
//                 return
//             }
//             toast.success('Payment initiated — opening payment gateway')

//             const shortUrl = data.responsePaymentShortUrl || data.paymentShortUrl || data.shortUrl

//             if (shortUrl) {
//                 toast.success('Redirecting to payment gateway...')
//                 // Use location.href to ensure navigation happens even if popups are blocked
//                 window.location.href = shortUrl
//                 return
//             }

//             // If no short URL but successful response, handle as manual request or error
//             const linkId = data.linkId || (data.paymentRequest && data.paymentRequest.razorpay && data.paymentRequest.razorpay.linkId) || data.paymentRequestId

//             if (!linkId) {
//                 // No payment link generated (maybe plan doesn't require immediate payment?), just close
//                 onClose && onClose(data)
//             } else {
//                 // Payment link exists but URL missing?
//                 toast.error('Payment link generated but URL is missing. Check email.')
//                 onClose && onClose(data)
//             }
//         } catch (e) {
//             console.error(e)
//             toast.error(e.message || 'Submit failed')
//         } finally {
//             setLoading(false)
//         }
//     }

//     async function validateAccess(e) {
//         e && e.preventDefault()
//         setAccessError(null)
//         if (!accessCode) return setAccessError('Access code required')
//         try {
//             const res = await fetch('/api/plans/validate-access', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ planId: plan?._id, code: accessCode }) })
//             if (!res.ok) {
//                 const err = await res.json().catch(() => ({}))
//                 throw new Error(err.error || 'Invalid code')
//             }
//             setAccessValidated(true)
//             toast.success('Access code validated')
//         } catch (err) {
//             console.error(err)
//             setAccessError(err.message || 'Invalid code')
//         }
//     }

//     return (
//         <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
//             <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200">
//                 {/* Brand Header */}
//                 <div className="bg-gradient-to-r from-slate-900 to-slate-800 p-6 flex justify-between items-start text-white">
//                     <div>
//                         <div className="flex items-center gap-2 mb-1">
//                             <ShieldCheck className="text-blue-400" size={24} />
//                             <h2 className="text-xl font-bold tracking-tight">{plan?.name || "HMS Plan"}</h2>
//                         </div>
//                         <p className="text-slate-300 text-sm">Complete your subscription setup securely</p>
//                     </div>
//                     <button onClick={() => onClose && onClose()} className="bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors">
//                         <X size={20} />
//                     </button>
//                 </div>

//                 <div className="flex-1 overflow-y-auto p-6 md:p-8">
//                     {plan?.customized && !accessValidated ? (
//                         <div className="max-w-md mx-auto py-12 text-center">
//                             <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
//                                 <Lock className="text-blue-600" size={32} />
//                             </div>
//                             <h3 className="text-xl font-semibold text-gray-900 mb-2">Restricted Access</h3>
//                             <p className="text-gray-500 mb-6">This plan requires a unique access code to proceed.</p>

//                             <div className="flex gap-2 max-w-xs mx-auto">
//                                 <input
//                                     value={accessCode}
//                                     onChange={e => setAccessCode(e.target.value)}
//                                     className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
//                                     placeholder="Enter Code"
//                                 />
//                                 <button onClick={validateAccess} className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors">
//                                     Verify
//                                 </button>
//                             </div>
//                             {accessError && <div className="text-red-500 text-sm mt-3 font-medium bg-red-50 py-1 px-3 rounded inline-block">{accessError}</div>}
//                         </div>
//                     ) : (
//                         <form onSubmit={submit} className="space-y-8">
//                             {/* Summary Card */}
//                             <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-5 flex flex-col md:flex-row justify-between items-center gap-4">
//                                 <div>
//                                     <label className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-1 block">Selected Plan</label>
//                                     <h4 className="text-lg font-bold text-gray-900">{plan?.name}</h4>
//                                 </div>
//                                 <div className="flex items-center gap-4 bg-white px-4 py-2 rounded-lg border border-blue-100 shadow-sm">
//                                     <div className="text-right">
//                                         <div className="text-2xl font-bold text-gray-900 leading-none">{displayAmount}</div>
//                                         <div className="text-xs text-gray-500 mt-1">Total Amount</div>
//                                     </div>
//                                     <div className="h-8 w-px bg-gray-200 mx-2 hidden md:block"></div>
//                                     <select
//                                         value={period}
//                                         onChange={e => setPeriod(e.target.value)}
//                                         className="bg-transparent text-sm font-medium text-gray-700 focus:outline-none cursor-pointer"
//                                     >
//                                         <option value="monthly">Monthly</option>
//                                         <option value="3months">Quarterly</option>
//                                         <option value="yearly">Yearly</option>
//                                         <option value="5years">5 Years</option>
//                                     </select>
//                                 </div>
//                             </div>

//                             {/* Details Grid */}
//                             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
//                                 <div className="md:col-span-2 space-y-4">
//                                     <div className="flex items-center gap-2 mb-2 pb-2 border-b border-gray-100">
//                                         <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 font-bold text-xs">1</div>
//                                         <h5 className="text-sm font-semibold text-gray-900">Billing Information</h5>
//                                     </div>
//                                 </div>

//                                 <InputField label="Customer Name" value={customerName} onChange={setCustomerName} placeholder="Jane Doe" required />
//                                 <InputField label="Email Address" type="email" value={customerEmail} onChange={setCustomerEmail} placeholder="jane@company.com" required />

//                                 <div>
//                                     <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone Number</label>
//                                     <div className="flex group focus-within:ring-2 focus-within:ring-blue-500/20 rounded-lg transition-all">
//                                         <select
//                                             value={countryCode}
//                                             onChange={e => setCountryCode(e.target.value)}
//                                             className="px-3 py-2.5 border border-r-0 border-gray-200 rounded-l-lg bg-gray-50 outline-none text-sm text-gray-600 hover:bg-gray-100 transition-colors"
//                                         >
//                                             <option value="+91">+91</option>
//                                             <option value="+1">+1</option>
//                                             <option value="+44">+44</option>
//                                             <option value="+971">+971</option>
//                                         </select>
//                                         <input
//                                             value={customerPhone}
//                                             onChange={e => setCustomerPhone(e.target.value)}
//                                             className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-r-lg outline-none transition-all placeholder:text-gray-400 group-focus-within:bg-white group-focus-within:border-blue-500"
//                                             placeholder="9876543210"
//                                         />
//                                     </div>
//                                 </div>
//                                 <InputField label="Organization / Hospital" value={company} onChange={setCompany} placeholder="Optional" />

//                                 <div className="md:col-span-2">
//                                     <InputField label="Billing Address" value={address} onChange={setAddress} placeholder="Street address, City, State, Zip" />
//                                 </div>

//                                 <div className="md:col-span-2 space-y-4 pt-4">
//                                     <div className="flex items-center gap-2 mb-2 pb-2 border-b border-gray-100">
//                                         <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 font-bold text-xs">2</div>
//                                         <h5 className="text-sm font-semibold text-gray-900">Additional Details</h5>
//                                     </div>
//                                 </div>

//                                 <div className="md:col-span-2">
//                                     <label className="block text-sm font-medium text-gray-700 mb-1.5">Description / Notes</label>
//                                     <textarea
//                                         value={description}
//                                         onChange={e => setDescription(e.target.value)}
//                                         className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all resize-none focus:bg-white shadow-sm"
//                                         rows={2}
//                                         placeholder="Any specific requests?"
//                                     />
//                                 </div>

//                                 <div>
//                                     <label className="block text-sm font-medium text-gray-700 mb-1.5">Identity Document <span className="text-gray-400 font-normal">(Optional)</span></label>
//                                     <div className="relative">
//                                         <input
//                                             type="file"
//                                             accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
//                                             onChange={e => setFile(e.target.files[0])}
//                                             className="w-full text-sm text-gray-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 transition-all border border-gray-200 rounded-lg bg-gray-50"
//                                         />
//                                     </div>
//                                 </div>
//                             </div>

//                             {/* Footer / Actions */}
//                             <div className="pt-6 border-t border-gray-100 bg-gray-50/50 -mx-6 -mb-6 md:-mx-8 md:-mb-8 px-6 md:px-8 py-4 mt-8 rounded-b-2xl">
//                                 <div className="flex items-center gap-3 mb-4">
//                                     <div className="flex items-center h-5">
//                                         <input
//                                             id="plan-agree"
//                                             type="checkbox"
//                                             checked={agree}
//                                             onChange={e => setAgree(e.target.checked)}
//                                             className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
//                                         />
//                                     </div>
//                                     <label htmlFor="plan-agree" className="text-sm text-gray-600 select-none cursor-pointer">
//                                         I agree to the <a href="#" className="text-blue-600 hover:underline font-medium">Terms of Service</a> and <a href="#" className="text-blue-600 hover:underline font-medium">Privacy Policy</a>
//                                     </label>
//                                 </div>

//                                 <div className="flex justify-between items-center">
//                                     <div className="text-xs text-gray-400 hidden sm:flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-full border border-gray-100 shadow-sm">
//                                         <ShieldCheck size={14} className="text-green-500" />
//                                         <span className="font-medium text-gray-600">Secure 256-bit SSL Payment</span>
//                                     </div>
//                                     <div className="flex gap-3 w-full sm:w-auto">
//                                         <button
//                                             type="button"
//                                             onClick={() => onClose && onClose()}
//                                             className="flex-1 sm:flex-none px-6 py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 hover:text-gray-900 transition-all shadow-sm hover:shadow"
//                                         >
//                                             Cancel
//                                         </button>
//                                         <button
//                                             type="submit"
//                                             disabled={!agree || loading}
//                                             className={`flex-1 sm:flex-none px-8 py-2.5 text-sm font-medium text-white rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all transform active:scale-95
//                                                 ${(!agree || loading)
//                                                     ? 'bg-gray-400 cursor-not-allowed shadow-none'
//                                                     : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-blue-500/25 hover:-translate-y-0.5'
//                                                 }`}
//                                         >
//                                             {loading ? 'Processing...' : (
//                                                 <>
//                                                     Pay {displayAmount}
//                                                     <CreditCard size={16} />
//                                                 </>
//                                             )}
//                                         </button>
//                                     </div>
//                                 </div>
//                             </div>
//                         </form>
//                     )}
//                 </div>
//             </div>
//         </div>
//     )
// }

// function InputField({ label, value, onChange, type = "text", placeholder, required }) {
//     return (
//         <div>
//             <label className="block text-sm font-medium text-gray-700 mb-1.5">
//                 {label} {required && <span className="text-red-500">*</span>}
//             </label>
//             <input
//                 type={type}
//                 value={value}
//                 onChange={e => onChange(e.target.value)}
//                 className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder:text-gray-400"
//                 placeholder={placeholder}
//                 required={required}
//             />
//         </div>
//     )
// }

import React, { useState, useEffect, useRef } from 'react'
import { toast } from 'react-toastify'
import { X, CreditCard, ShieldCheck, CheckCircle, Lock } from 'lucide-react'

export default function PlanPurchaseModal({ plan, open, onClose }) {
    const [customerName, setCustomerName] = useState('')
    const [customerEmail, setCustomerEmail] = useState('')
    const [countryCode, setCountryCode] = useState('+91')
    const [customerPhone, setCustomerPhone] = useState('')
    const [address, setAddress] = useState('')
    const [description, setDescription] = useState('')
    const [company, setCompany] = useState('')
    const [period, setPeriod] = useState('monthly')
    const [agree, setAgree] = useState(false)
    const [file, setFile] = useState(null)
    const [loading, setLoading] = useState(false)
    const [accessCode, setAccessCode] = useState('')
    const [accessValidated, setAccessValidated] = useState(false)
    const [accessError, setAccessError] = useState(null)
    const [submitted, setSubmitted] = useState(false)

    // Pre-warm the Render backend as soon as the modal opens so the cold-start
    // delay (30-60s on free tier) happens in the background, not during submit.
    const warmedRef = useRef(false)
    useEffect(() => {
        if (!open || warmedRef.current) return
        warmedRef.current = true
        // Hit the /health endpoint to wake the dyno; ignore the result.
        fetch('/health', { method: 'GET' }).catch(() => { })
    }, [open])

    if (!open) return null

    const displayAmount = (() => {
        const amt = computeAmountForPeriod(plan, period)
        return (amt && !isNaN(amt)) ? `₹${(amt / 100).toLocaleString('en-IN')}` : '—'
    })()

    function computeAmountForPeriod(plan, period) {
        // Standardize period to internal keys
        const p = (period || 'monthly').toLowerCase()
        
        // 1. If this is a customized plan with explicit durations, prefer those prices
        if (plan && plan.customized && Array.isArray(plan.durations) && plan.durations.length > 0) {
            const wanted = (() => {
                switch (p) {
                    case '3months': return { unit: 'months', length: 3 }
                    case 'yearly': return { unit: 'years', length: 1 }
                    case '5years': return { unit: 'years', length: 5 }
                    default: return { unit: 'months', length: 1 }
                }
            })()
            const found = plan.durations.find(d => (d.unit === wanted.unit || d.unit + 's' === wanted.unit) && Number(d.length) === wanted.length)
            if (found && typeof found.price !== 'undefined') {
                return Number(found.price) // Assumed to be stored as paise
            }
        }
        
        // 2. Fallback to standard prices object
        if (!plan || !plan.prices) return 0
        const prices = plan.prices || {}
        let amt = 0
        switch (p) {
            case '3months': amt = prices.threeMonths || prices['3months'] || 0; break
            case 'yearly': amt = prices.year || prices.yearly || 0; break
            case '5years': amt = prices.fiveYears || 0; break
            default: amt = prices.month || prices.monthly || 0
        }
        
        if (!amt) {
            const base = prices.month || prices.monthly || 0
            if (base) {
                if (p === '3months') amt = base * 3
                else if (p === 'yearly') amt = base * 12
                else if (p === '5years') amt = base * 60
                else amt = base
            }
        }
        return Number(amt || 0)
    }

    async function submit(e) {
        e.preventDefault()
        if (!agree) return toast.error('You must agree to terms')
        if (!customerName || !customerEmail) return toast.error('Name and email required')
        setLoading(true)
        try {
            const fd = new FormData()
            fd.append('planName', plan?.name || '')
            if (plan?._id) fd.append('planId', plan._id)
            fd.append('customerName', customerName)
            fd.append('customerEmail', customerEmail)
            fd.append('customerCountryCode', countryCode)
            fd.append('customerPhone', customerPhone)
            fd.append('address', address)
            fd.append('description', description)
            fd.append('company', company)
            fd.append('period', period)
            // include computed amount (in RUPEES) so frontend and backend are consistent
            const amount = computeAmountForPeriod(plan, period)
            fd.append('amount', String(amount / 100))
            fd.append('agreed', agree ? 'true' : 'false')
            if (file) fd.append('idDocument', file, file.name)

            // Call the new public endpoint which creates the PlanRequest, invoice and a payment link.
            // Use an AbortController with a generous timeout (55s) to handle Render cold starts.
            const controller = new AbortController()
            const timeoutId = setTimeout(() => controller.abort(), 55000)
            let res
            try {
                res = await fetch('/api/plan-requests/pay', {
                    method: 'POST',
                    body: fd,
                    signal: controller.signal,
                })
            } catch (fetchErr) {
                clearTimeout(timeoutId)
                if (fetchErr.name === 'AbortError') {
                    throw new Error('The server took too long to respond. The backend may be starting up — please wait 30 seconds and try again.')
                }
                throw new Error('Network error — please check your connection and try again.')
            }
            clearTimeout(timeoutId)

            let data
            try {
                data = await res.json()
            } catch (err) {
                // Server returned non-JSON (e.g. Render's HTML error page on 502)
                console.error('Failed to parse response', err, 'HTTP status:', res.status)
                if (res.status === 502 || res.status === 503 || res.status === 504) {
                    throw new Error('The server is temporarily unavailable (likely starting up). Please wait 30 seconds and try again.')
                }
                throw new Error('Server returned an unexpected response. Please try again or contact support.')
            }

            if (!res.ok) {
                const msg = data.detail || data.error || 'Failed to initiate payment'
                throw new Error(msg)
            }

            // If server indicates a non-test Razorpay key, block payment to enforce test-mode only
            if (data.keyId && !String(data.keyId).startsWith('rzp_test_')) {
                toast.error('Payments are restricted to Razorpay test mode. Please contact administrator.')
                onClose && onClose(data)
                setLoading(false)
                return
            }
            toast.success('Request submitted successfully')

            const shortUrl = data.responsePaymentShortUrl || data.paymentShortUrl || data.shortUrl

            if (shortUrl) {
                toast.success('Redirecting to payment gateway...')
                // Use location.href to ensure navigation happens even if popups are blocked
                window.location.href = shortUrl
                return
            }

            // If no short URL, it means it's a manual request (new flow)
            setSubmitted(true)
        } catch (e) {
            console.error(e)
            toast.error(e.message || 'Submit failed')
        } finally {
            setLoading(false)
        }
    }

    async function validateAccess(e) {
        e && e.preventDefault()
        setAccessError(null)
        if (!accessCode) return setAccessError('Access code required')
        try {
            const res = await fetch('/api/plans/validate-access', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ planId: plan?._id, code: accessCode }) })
            if (!res.ok) {
                const err = await res.json().catch(() => ({}))
                throw new Error(err.error || 'Invalid code')
            }
            setAccessValidated(true)
            toast.success('Access code validated')
        } catch (err) {
            console.error(err)
            setAccessError(err.message || 'Invalid code')
        }
    }

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200">
                {/* Brand Header */}
                <div className="bg-gradient-to-r from-slate-900 to-slate-800 p-6 flex justify-between items-start text-white">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <ShieldCheck className="text-blue-400" size={24} />
                            <h2 className="text-xl font-bold tracking-tight">{plan?.name || "HMS Plan"}</h2>
                        </div>
                        <p className="text-slate-300 text-sm">Complete your subscription setup securely</p>
                    </div>
                    <button onClick={() => onClose && onClose()} className="bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 md:p-8">
                    {submitted ? (
                        <div className="py-16 px-8 text-center animate-in zoom-in-95 duration-300">
                            <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6 scale-110 shadow-sm border border-green-100">
                                <CheckCircle className="text-green-600" size={40} />
                            </div>
                            <h3 className="text-2xl font-bold text-gray-900 mb-3">Request Received!</h3>
                            <p className="text-gray-600 max-w-sm mx-auto mb-8 leading-relaxed">
                                Thank you for your interest in the <strong>{plan?.name}</strong>. Our administrative team will review your application and identity documents.
                            </p>
                            <div className="bg-blue-50/50 rounded-xl p-5 mb-8 border border-blue-100/50 max-w-md mx-auto">
                                <p className="text-sm text-blue-700 font-medium">
                                    A confirmation email has been sent to <span className="underline">{customerEmail}</span>. You will receive the payment link once approved.
                                </p>
                            </div>
                            <button
                                onClick={() => onClose && onClose()}
                                className="w-full sm:w-auto px-10 py-3 bg-slate-900 hover:bg-black text-white font-bold rounded-xl transition-all shadow-xl hover:shadow-2xl active:scale-95"
                            >
                                Got it, Thanks!
                            </button>
                        </div>
                    ) : plan?.customized && !accessValidated ? (
                        <div className="max-w-md mx-auto py-12 text-center">
                            <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Lock className="text-blue-600" size={32} />
                            </div>
                            <h3 className="text-xl font-semibold text-gray-900 mb-2">Restricted Access</h3>
                            <p className="text-gray-500 mb-6">This plan requires a unique access code to proceed.</p>

                            <div className="flex gap-2 max-w-xs mx-auto">
                                <input
                                    value={accessCode}
                                    onChange={e => setAccessCode(e.target.value)}
                                    className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                                    placeholder="Enter Code"
                                />
                                <button onClick={validateAccess} className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors">
                                    Verify
                                </button>
                            </div>
                            {accessError && <div className="text-red-500 text-sm mt-3 font-medium bg-red-50 py-1 px-3 rounded inline-block">{accessError}</div>}
                        </div>
                    ) : (
                        <form onSubmit={submit} className="space-y-8">
                            {/* Summary Card */}
                            <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-5 flex flex-col md:flex-row justify-between items-center gap-4">
                                <div>
                                    <label className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-1 block">Selected Plan</label>
                                    <h4 className="text-lg font-bold text-gray-900">{plan?.name}</h4>
                                </div>
                                <div className="flex items-center gap-4 bg-white px-4 py-2 rounded-lg border border-blue-100 shadow-sm">
                                    <div className="text-right">
                                        <div className="text-2xl font-bold text-gray-900 leading-none">{displayAmount}</div>
                                        <div className="text-xs text-gray-500 mt-1">Total Amount</div>
                                    </div>
                                    <div className="h-8 w-px bg-gray-200 mx-2 hidden md:block"></div>
                                    <select
                                        value={period}
                                        onChange={e => setPeriod(e.target.value)}
                                        className="bg-transparent text-sm font-medium text-gray-700 focus:outline-none cursor-pointer"
                                    >
                                        <option value="monthly">Monthly</option>
                                        <option value="3months">Quarterly</option>
                                        <option value="yearly">Yearly</option>
                                        <option value="5years">5 Years</option>
                                    </select>
                                </div>
                            </div>

                            {/* Details Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="md:col-span-2 space-y-4">
                                    <div className="flex items-center gap-2 mb-2 pb-2 border-b border-gray-100">
                                        <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 font-bold text-xs">1</div>
                                        <h5 className="text-sm font-semibold text-gray-900">Billing Information</h5>
                                    </div>
                                </div>

                                <InputField label="Customer Name" value={customerName} onChange={setCustomerName} placeholder="Jane Doe" required />
                                <InputField label="Email Address" type="email" value={customerEmail} onChange={setCustomerEmail} placeholder="jane@company.com" required />

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone Number</label>
                                    <div className="flex group focus-within:ring-2 focus-within:ring-blue-500/20 rounded-lg transition-all">
                                        <select
                                            value={countryCode}
                                            onChange={e => setCountryCode(e.target.value)}
                                            className="px-3 py-2.5 border border-r-0 border-gray-200 rounded-l-lg bg-gray-50 outline-none text-sm text-gray-600 hover:bg-gray-100 transition-colors"
                                        >
                                            <option value="+91">+91</option>
                                            <option value="+1">+1</option>
                                            <option value="+44">+44</option>
                                            <option value="+971">+971</option>
                                        </select>
                                        <input
                                            value={customerPhone}
                                            onChange={e => setCustomerPhone(e.target.value)}
                                            className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-r-lg outline-none transition-all placeholder:text-gray-400 group-focus-within:bg-white group-focus-within:border-blue-500"
                                            placeholder="9876543210"
                                        />
                                    </div>
                                </div>
                                <InputField label="Organization / Hospital" value={company} onChange={setCompany} placeholder="Optional" />

                                <div className="md:col-span-2">
                                    <InputField label="Billing Address" value={address} onChange={setAddress} placeholder="Street address, City, State, Zip" />
                                </div>

                                <div className="md:col-span-2 space-y-4 pt-4">
                                    <div className="flex items-center gap-2 mb-2 pb-2 border-b border-gray-100">
                                        <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 font-bold text-xs">2</div>
                                        <h5 className="text-sm font-semibold text-gray-900">Additional Details</h5>
                                    </div>
                                </div>

                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Description / Notes</label>
                                    <textarea
                                        value={description}
                                        onChange={e => setDescription(e.target.value)}
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all resize-none focus:bg-white shadow-sm"
                                        rows={2}
                                        placeholder="Any specific requests?"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Identity Document <span className="text-gray-400 font-normal">(Optional)</span></label>
                                    <div className="relative">
                                        <input
                                            type="file"
                                            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                                            onChange={e => setFile(e.target.files[0])}
                                            className="w-full text-sm text-gray-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 transition-all border border-gray-200 rounded-lg bg-gray-50"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Footer / Actions */}
                            <div className="pt-6 border-t border-gray-100 bg-gray-50/50 -mx-6 -mb-6 md:-mx-8 md:-mb-8 px-6 md:px-8 py-4 mt-8 rounded-b-2xl">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="flex items-center h-5">
                                        <input
                                            id="plan-agree"
                                            type="checkbox"
                                            checked={agree}
                                            onChange={e => setAgree(e.target.checked)}
                                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                                        />
                                    </div>
                                    <label htmlFor="plan-agree" className="text-sm text-gray-600 select-none cursor-pointer">
                                        I agree to the <a href="#" className="text-blue-600 hover:underline font-medium">Terms of Service</a> and <a href="#" className="text-blue-600 hover:underline font-medium">Privacy Policy</a>
                                    </label>
                                </div>

                                <div className="flex justify-between items-center">
                                    <div className="text-xs text-gray-400 hidden sm:flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-full border border-gray-100 shadow-sm">
                                        <ShieldCheck size={14} className="text-green-500" />
                                        <span className="font-medium text-gray-600">Secure 256-bit SSL Payment</span>
                                    </div>
                                    <div className="flex gap-3 w-full sm:w-auto">
                                        <button
                                            type="button"
                                            onClick={() => onClose && onClose()}
                                            className="flex-1 sm:flex-none px-6 py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 hover:text-gray-900 transition-all shadow-sm hover:shadow"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={!agree || loading}
                                            className={`flex-1 sm:flex-none px-8 py-2.5 text-sm font-medium text-white rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all transform active:scale-95
                                                ${(!agree || loading)
                                                    ? 'bg-gray-400 cursor-not-allowed shadow-none'
                                                    : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-blue-500/25 hover:-translate-y-0.5'
                                                }`}
                                        >
                                            {loading ? 'Processing...' : (
                                                <>
                                                    Request Subscription
                                                    <ShieldCheck size={16} />
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    )
}

function InputField({ label, value, onChange, type = "text", placeholder, required }) {
    return (
        <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
                {label} {required && <span className="text-red-500">*</span>}
            </label>
            <input
                type={type}
                value={value}
                onChange={e => onChange(e.target.value)}
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder:text-gray-400"
                placeholder={placeholder}
                required={required}
            />
        </div>
    )
}
