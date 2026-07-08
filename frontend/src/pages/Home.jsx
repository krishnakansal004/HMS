import { useProfileRender } from '../utils/profiler';
import React, { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'react-toastify'
import { useAuth } from '../context/AuthContext'
import PlanPurchaseModal from '../components/PlanPurchaseModal'
import CustomizedPlanRequestModal from '../components/CustomizedPlanRequestModal'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronRight, Star, Shield, Activity, Users, ArrowRight, CheckCircle2 } from 'lucide-react'

export default function Home() {
    useProfileRender('Home', true);
    const slides = [
        {
            src: '/first.webp',
            subtitle: 'NEXT-GEN HOSPITAL MANAGEMENT',
            title: 'The Future of Healthcare Operations',
            desc: 'Streamline appointments, clinical workflows, pharmacy and billing with a secure, fast and clinician-first platform.',
            gradient: 'from-blue-600 to-indigo-700'
        },
        {
            src: '/healthcare-it-solutions.webp',
            subtitle: 'INTEGRATED BILLING & PHARMACY',
            title: 'Seamless Financial Control',
            desc: 'Automate billing, track inventory in real-time and reduce revenue leakage with our advanced financial modules.',
            gradient: 'from-emerald-600 to-teal-700'
        },
        {
            src: '/Telemedicine-SoftClinic-GenX.webp',
            subtitle: 'TELEMEDICINE READY',
            title: 'Care Beyond Boundaries',
            desc: 'Enable remote consultations and digital prescriptions. Expand your reach and provide care anywhere, anytime.',
            gradient: 'from-violet-600 to-purple-700'
        },
    ]

    const [slideIndex, setSlideIndex] = useState(0)
    const navigate = useNavigate()
    const [searchParams, setSearchParams] = useSearchParams()
    const { token, user } = useAuth()
    const [plans, setPlans] = useState([])
    const [plansError, setPlansError] = useState(null)
    const [selectedPlan, setSelectedPlan] = useState(null)
    const [showBuyModal, setShowBuyModal] = useState(false)
    const [showCustomizeModal, setShowCustomizeModal] = useState(false)

    // Auto-advance slides
    useEffect(() => {
        const t = setInterval(() => {
            setSlideIndex((i) => (i + 1) % slides.length)
        }, 6000)
        return () => clearInterval(t)
    }, [slides.length])

    useEffect(() => { loadPlans() }, [])

    // Check for payment redirect
    useEffect(() => {
        const redirect = searchParams.get('payment_redirect')
        const linkId = searchParams.get('razorpay_payment_link_id')
        const status = searchParams.get('razorpay_payment_link_status')

        if (redirect && linkId) {
            verifyPayment(linkId, status)
            // Clear params to prevent double verify
            setSearchParams({}, { replace: true })
        }
    }, [searchParams])

    async function verifyPayment(linkId, statusFromUrl) {
        const toastId = toast.loading('Verifying payment...')
        try {
            const API_BASE = (typeof import.meta !== 'undefined' && import.meta.env && typeof import.meta.env.VITE_API_URL !== 'undefined')
                ? (import.meta.env.VITE_API_URL || '') : ''
            const res = await fetch(`${API_BASE}/api/payments/razorpay/check-public/${linkId}`)
            const data = await res.json()

            if (res.ok && (data.paid || data.status === 'paid' || statusFromUrl === 'paid')) {
                toast.update(toastId, { render: 'Payment Verified! Check your email for login credentials.', type: 'success', isLoading: false, autoClose: 8000 })
                // If user is a guest, send them to login. If logged in (e.g., director), don't disrupt them.
                if (!token) {
                    setTimeout(() => navigate('/login'), 2000)
                }
            } else {
                toast.update(toastId, { render: 'Payment verification status: ' + (data.status || 'Pending'), type: 'info', isLoading: false, autoClose: 5000 })
            }
        } catch (e) {
            console.error(e)
            toast.update(toastId, { render: 'Payment verification failed. Please contact support.', type: 'error', isLoading: false, autoClose: 5000 })
        }
    }

    async function loadPlans() {
        try {
            const API_BASE = (typeof import.meta !== 'undefined' && import.meta.env && typeof import.meta.env.VITE_API_URL !== 'undefined')
                ? (import.meta.env.VITE_API_URL || '') : ''
            const url = `${API_BASE}/api/plans`
            const res = await fetch(url)
            if (!res.ok) throw new Error('Failed to load plans')
            const data = await res.json()
            setPlans(data.plans || [])
        } catch (e) {
            console.error('Failed to load plans', e)
            setPlans([])
            setPlansError('Failed to load plans')
        }
    }

    function handleBuy(plan) {
        if (!token) toast.info('You can submit a purchase request as a guest; sign in later to track it')
        setSelectedPlan(plan)
        setShowBuyModal(true)
    }

    function computeAmountForPeriod(plan, period) {
        if (!plan || !plan.prices) return 0
        const prices = plan.prices || {}
        switch ((period || 'monthly')) {
            case '3months': return Number(prices.threeMonths || 0)
            case 'yearly': return Number(prices.year || prices.yearly || 0)
            case '5years': return Number(prices.fiveYears || 0)
            default: return Number(prices.month || 0)
        }
    }

    return (
        <main className="w-full overflow-x-hidden bg-slate-50 font-sans selection:bg-indigo-100 selection:text-indigo-900">
            {/* Hero Section */}
            <section className="relative h-[95vh] w-full overflow-hidden bg-slate-900">
                <AnimatePresence mode='wait'>
                    <motion.div
                        key={slideIndex}
                        initial={{ opacity: 0, scale: 1.1 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 1.5, ease: "easeOut" }}
                        className="absolute inset-0 z-0"
                    >
                        {/* Improved Gradient Overlay */}
                        <div className="absolute inset-0 bg-gradient-to-b from-slate-900/60 via-indigo-900/20 to-slate-900 z-10" />
                        <div className={`absolute inset-0 bg-gradient-to-r ${slides[slideIndex].gradient} opacity-30 mix-blend-overlay z-10`} />
                        <img
                            src={slides[slideIndex].src}
                            alt={slides[slideIndex].title}
                            className="h-full w-full object-cover object-center"
                            fetchpriority={slideIndex === 0 ? "high" : "low"}
                            loading={slideIndex === 0 ? "eager" : "lazy"}
                            decoding="async"
                        />
                    </motion.div>
                </AnimatePresence>

                {/* Content Overlay */}
                <div className="absolute inset-0 z-20 flex items-center justify-center px-6">
                    <div className="max-w-6xl w-full text-center text-white space-y-8">
                        <AnimatePresence mode='wait'>
                            <motion.div
                                key={`text-${slideIndex}`}
                                initial={{ y: 40, opacity: 0, filter: 'blur(10px)' }}
                                animate={{ y: 0, opacity: 1, filter: 'blur(0px)' }}
                                exit={{ y: -40, opacity: 0, filter: 'blur(10px)' }}
                                transition={{ duration: 0.8, ease: "easeOut" }}
                            >
                                <motion.span
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.3 }}
                                    className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-sm font-bold tracking-widest uppercase mb-6 hover:bg-white/20 transition-colors"
                                >
                                    <Star size={14} className="text-amber-400 fill-amber-400" />
                                    {slides[slideIndex].subtitle}
                                </motion.span>

                                <h1 className="text-3xl sm:text-4xl md:text-7xl lg:text-8xl font-black tracking-tight leading-tight drop-shadow-2xl">
                                    {slides[slideIndex].title}
                                </h1>

                                <p className="mt-4 md:mt-8 text-lg md:text-2xl text-slate-200 max-w-3xl mx-auto leading-relaxed font-medium drop-shadow-md px-4">
                                    {slides[slideIndex].desc}
                                </p>

                                <div className="mt-8 md:mt-12 flex flex-col sm:flex-row items-center justify-center gap-4 md:gap-6">
                                    <button
                                        onClick={() => {
                                            if (token) {
                                                if (user?.role === 'director') {
                                                    navigate('/director/dashboard');
                                                } else {
                                                    navigate('/dashboard');
                                                }
                                            } else {
                                                document.getElementById('plans-section')?.scrollIntoView({ behavior: 'smooth' })
                                            }
                                        }}
                                        className="w-full sm:w-auto group relative px-8 md:px-10 py-4 md:py-5 rounded-full bg-white text-slate-900 font-bold text-base md:text-lg hover:bg-indigo-50 transition-all shadow-xl active:scale-95 flex items-center justify-center gap-3 overflow-hidden"
                                    >
                                        <span className="relative z-10">See Plans & Pricing</span>
                                        <ChevronRight size={20} className="relative z-10 group-hover:translate-x-1 transition-transform" />
                                        <div className="absolute inset-0 bg-gradient-to-r from-indigo-50 to-white opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                                    </button>
                                    <button
                                        onClick={() => navigate('/contact')}
                                        className="w-full sm:w-auto px-8 md:px-10 py-4 md:py-5 rounded-full bg-slate-800/50 backdrop-blur-md border border-white/10 text-white font-semibold text-base md:text-lg hover:bg-slate-800/70 hover:border-white/30 transition-all active:scale-95 flex items-center justify-center gap-3"
                                    >
                                        Book a Demo
                                    </button>
                                </div>
                            </motion.div>
                        </AnimatePresence>
                    </div>
                </div>

                {/* Slider Dots */}
                <div className="absolute bottom-12 left-0 right-0 z-30 flex justify-center gap-4">
                    {slides.map((_, i) => (
                        <button
                            key={i}
                            onClick={() => setSlideIndex(i)}
                            className={`h-1.5 rounded-full transition-all duration-500 ${i === slideIndex ? 'w-12 bg-white shadow-[0_0_10px_rgba(255,255,255,0.8)]' : 'w-3 bg-white/30 hover:bg-white/50'}`}
                            aria-label={`Go to slide ${i + 1}`}
                        />
                    ))}
                </div>
            </section>

            {/* Stats Section with Glassmorphism */}
            <section className="relative -mt-16 md:-mt-24 z-30 px-4 sm:px-6 lg:px-16 pointer-events-none">
                <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 pointer-events-auto">
                    {[
                        { label: 'Clinics & Hospitals', value: '1,200+', icon: Shield, color: 'text-indigo-600', bg: 'bg-indigo-50' },
                        { label: 'Monthly Appointments', value: '150k+', icon: Activity, color: 'text-rose-600', bg: 'bg-rose-50' },
                        { label: 'Uptime Reliability', value: '99.9%', icon: Star, color: 'text-amber-500', bg: 'bg-amber-50' },
                    ].map((stat, i) => (
                        <motion.div
                            key={i}
                            initial={{ y: 50, opacity: 0 }}
                            whileInView={{ y: 0, opacity: 1 }}
                            viewport={{ once: true }}
                            transition={{ delay: i * 0.15, duration: 0.8, ease: "easeOut" }}
                            whileHover={{ y: -5, shadow: "0 25px 50px -12px rgba(0, 0, 0, 0.1)" }}
                            className="bg-white/95 backdrop-blur-xl rounded-2xl md:rounded-3xl p-6 md:p-8 shadow-xl border border-white/50 flex items-center gap-4 md:gap-8 group"
                        >
                            <div className={`p-4 md:p-5 rounded-xl md:rounded-2xl ${stat.bg} ${stat.color} group-hover:scale-110 transition-transform duration-300 flex-shrink-0`}>
                                <stat.icon size={28} className="md:w-10 md:h-10" />
                            </div>
                            <div>
                                <div className="text-2xl md:text-4xl font-black text-slate-900 tracking-tight">{stat.value}</div>
                                <div className="text-[10px] md:text-sm text-slate-500 font-bold uppercase tracking-wider mt-1 md:mt-2">{stat.label}</div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </section>

            {/* Feature Overview */}
            <section className="py-32 px-6 lg:px-16 bg-white overflow-hidden relative">
                {/* Background Decor */}
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-50/50 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-rose-50/50 rounded-full blur-3xl -ml-32 -mb-32 pointer-events-none" />

                <div className="max-w-7xl mx-auto relative z-10">
                    <div className="text-center mb-20">
                        <motion.span
                            initial={{ opacity: 0 }}
                            whileInView={{ opacity: 1 }}
                            className="text-indigo-600 font-bold tracking-widest text-sm uppercase bg-indigo-50 px-4 py-2 rounded-full"
                        >
                            Why Choose Us
                        </motion.span>
                        <motion.h2
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            className="mt-8 text-4xl md:text-5xl lg:text-6xl font-black text-slate-900 tracking-tight"
                        >
                            Everything for a <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600">Modern</span> Practice
                        </motion.h2>
                    </div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {[
                            'Real-time Queue Management', 'Electronic Health Records (EHR)', 'Integrated Pharmacy & Inventory',
                            'Automated Billing & Insurance', 'Telemedicine Suite', 'Advanced Analytics Dashboard'
                        ].map((feature, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, scale: 0.9 }}
                                whileInView={{ opacity: 1, scale: 1 }}
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.1 }}
                                whileHover={{ scale: 1.03, y: -5 }}
                                className="group p-8 rounded-3xl bg-slate-50 hover:bg-white border border-slate-100 hover:border-indigo-100 hover:shadow-2xl hover:shadow-indigo-500/10 transition-all duration-300"
                            >
                                <div className="h-14 w-14 rounded-2xl bg-white border border-slate-200 flex items-center justify-center mb-6 group-hover:border-indigo-200 group-hover:bg-indigo-50 group-hover:text-indigo-600 shadow-sm transition-colors text-slate-400">
                                    <CheckCircle2 size={28} />
                                </div>
                                <h3 className="text-xl font-bold text-slate-900 mb-3">{feature}</h3>
                                <p className="text-slate-600 leading-relaxed font-medium">Experience seamless operations with our industry-leading {feature.toLowerCase()} tools designed for modern healthcare.</p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Plans Section */}
            <section id="plans-section" className="py-32 px-6 lg:px-16 bg-slate-50 relative border-t border-slate-200">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-20 text-slate-900">
                        <h2 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight mb-6">Transparent Pricing</h2>
                        <p className="text-xl text-slate-600 max-w-2xl mx-auto">Choose the perfect plan for your facility.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 items-start">
                        {plans.length === 0 ? (
                            <div className="col-span-full py-20 text-center">
                                <span className="loading loading-dots loading-lg text-indigo-500"></span>
                            </div>
                        ) : plans.map((p, idx) => {
                            const isPopular = idx === 1; // Assuming 2nd plan is popular
                            return (
                                <motion.div
                                    key={p._id}
                                    initial={{ opacity: 0, y: 50 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true }}
                                    transition={{ delay: idx * 0.1 }}
                                    className={`relative bg-white rounded-[2.5rem] p-6 md:p-10 border transition-all duration-500 flex flex-col ${isPopular
                                        ? 'shadow-2xl shadow-indigo-500/20 border-indigo-200 scale-105 z-10'
                                        : 'shadow-xl border-slate-100 hover:border-slate-300 hover:shadow-2xl'
                                        }`}
                                >
                                    {isPopular && (
                                        <div className="absolute top-0 inset-x-0 -mt-5 flex justify-center">
                                            <span className="bg-indigo-600 text-white text-xs font-bold px-6 py-2 rounded-full uppercase tracking-widest shadow-lg shadow-indigo-500/40">
                                                Most Popular
                                            </span>
                                        </div>
                                    )}

                                    <h3 className="text-2xl font-bold text-slate-900">{p.name}</h3>
                                    <p className="text-slate-500 mt-3 font-medium min-h-[3rem] text-sm leading-relaxed">{p.description}</p>

                                    <div className="my-8 pt-8 border-t border-slate-100">
                                        {p.customized ? (
                                            <div>
                                                <span className="text-4xl font-extrabold text-slate-900">Custom</span>
                                                <span className="block text-slate-400 font-medium mt-1">tailored pricing</span>
                                            </div>
                                        ) : (
                                            <div className="flex items-baseline gap-1">
                                                <span className="text-5xl font-black text-slate-900 tracking-tight">
                                                    ₹{(computeAmountForPeriod(p, 'monthly') / 100).toFixed(0)}
                                                </span>
                                                <span className="text-slate-500 font-semibold text-lg">/mo</span>
                                            </div>
                                        )}
                                    </div>

                                    <ul className="space-y-4 mb-10 flex-1">
                                        <li className="font-bold text-slate-900 text-sm uppercase tracking-wide mb-4 opacity-50">Includes</li>
                                        {[
                                            `Admins: ${p.limits?.admins || 0}`,
                                            `Doctors: ${p.limits?.doctors || 0}`,
                                            `Patients: ${p.limits?.patients || 0}`,
                                            ...(p.roleFeatures?.admin || []).slice(0, 3).map(f => f.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '))
                                        ].map((feat, i) => (
                                            <li key={i} className="flex items-center gap-3 text-slate-700 font-medium">
                                                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                                                    <CheckCircle2 size={14} strokeWidth={3} />
                                                </div>
                                                {feat}
                                            </li>
                                        ))}
                                    </ul>

                                    <button
                                        onClick={() => handleBuy(p)}
                                        className={`w-full py-4 rounded-2xl font-bold text-lg transition-all active:scale-95 flex items-center justify-center gap-2 ${isPopular
                                            ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-xl shadow-indigo-500/30'
                                            : 'bg-slate-900 text-white hover:bg-slate-800'
                                            }`}
                                    >
                                        {p.customized ? 'Contact Sales' : 'Choose Plan'} <ArrowRight size={18} />
                                    </button>
                                </motion.div>
                            );
                        })}
                    </div>

                    {/* Customize Plan Banner */}
                    <div className="mt-24 rounded-[3rem] p-6 md:p-12 relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-10 bg-slate-900 text-white">
                        <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-purple-600 opacity-20" />
                        <div className="absolute -top-24 -right-24 w-64 h-64 bg-indigo-500 blur-3xl rounded-full opacity-40 animate-pulse" />

                        <div className="relative z-10 max-w-2xl">
                            <h3 className="text-3xl font-bold mb-4">Enterprise Requirements?</h3>
                            <p className="text-slate-300 text-lg leading-relaxed">
                                Get a tailored solution for your hospital network. We offer dedicated support, custom API integrations, and SLA guarantees.
                            </p>
                        </div>
                        <button
                            onClick={() => setShowCustomizeModal(true)}
                            className="relative z-10 px-10 py-4 bg-white text-slate-900 font-bold rounded-2xl hover:bg-indigo-50 transition-all shadow-xl active:scale-95 min-w-max"
                        >
                            Request Custom Plan
                        </button>
                    </div>
                </div>
            </section>

            {/* Find Specialists */}
            <section className="py-32 px-6 lg:px-16 bg-white border-t border-slate-100">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-16">
                        <span className="text-indigo-600 font-bold tracking-widest text-xs uppercase bg-indigo-50 px-3 py-1.5 rounded-full mb-4 inline-block">Specialized Care</span>
                        <h2 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight">Find Your Specialist</h2>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
                        {['General', 'Cardiology', 'Dermatology', 'Neurology', 'Orthopedics', 'Pediatrics', 'Dentistry', 'Gynecology', 'ENT', 'Psychiatry', 'Ophthalmology', 'Urology'].map((spec, i) => (
                            <motion.button
                                key={spec}
                                whileHover={{ scale: 1.05, y: -4 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => navigate(`/doctors-public?q=${encodeURIComponent(spec)}`)}
                                className="group p-6 rounded-3xl bg-slate-50 hover:bg-white hover:shadow-xl hover:shadow-indigo-500/10 border border-slate-100 transition-all flex flex-col items-center justify-center gap-4 text-center aspect-square"
                            >
                                <div className="w-16 h-16 rounded-2xl bg-white border border-slate-100 text-indigo-600 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors duration-300 shadow-sm">
                                    <Activity size={28} />
                                </div>
                                <span className="font-bold text-slate-700 group-hover:text-indigo-600 transition-colors text-sm">{spec}</span>
                            </motion.button>
                        ))}
                    </div>

                    <div className="mt-16 text-center">
                        <button
                            onClick={() => navigate('/doctors-public')}
                            className="text-indigo-600 font-bold hover:text-indigo-800 flex items-center justify-center gap-2 mx-auto group"
                        >
                            View All Doctors <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                        </button>
                    </div>
                </div>
            </section>

            {/* Testimonials */}
            <section className="py-32 px-6 lg:px-16 bg-slate-50 border-t border-slate-200">
                <div className="max-w-7xl mx-auto">
                    <h2 className="text-3xl font-black text-slate-900 text-center mb-16">Trusted by Leaders</h2>
                    <div className="grid md:grid-cols-2 gap-10">
                        {[
                            { quote: "HospitechVerse transformed our outpatient flow. We reduced patient wait times by 40% in just two months.", author: "Dr. Meera Singh, Clinic Director" },
                            { quote: "The billing and inventory modules saved us significant costs. It's the most intuitive platform we've used.", author: "Rajesh Kumar, Chief Pharmacist" }
                        ].map((t, i) => (
                            <motion.div
                                key={i}
                                whileHover={{ y: -5 }}
                                className="p-10 bg-white rounded-[2rem] shadow-lg border border-slate-100 relative group overflow-hidden"
                            >
                                <div className="absolute top-0 right-0 p-8 opacity-10 text-indigo-600">
                                    <Star size={120} fill="currentColor" />
                                </div>

                                <div className="text-amber-400 mb-6 flex gap-1">
                                    {[1, 2, 3, 4, 5].map(s => <Star key={s} size={20} fill="currentColor" />)}
                                </div>
                                <p className="text-xl text-slate-700 font-medium leading-relaxed relative z-10 mb-8">"{t.quote}"</p>
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-500 text-lg">
                                        {t.author[0]}
                                    </div>
                                    <div>
                                        <div className="font-bold text-slate-900">{t.author.split(',')[0]}</div>
                                        <div className="text-sm text-slate-500">{t.author.split(',')[1]}</div>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Footer CTA */}
            <section className="py-32 px-6 bg-slate-900 text-center relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/50 to-slate-900" />
                <div className="relative z-10 max-w-4xl mx-auto space-y-8">
                    <h2 className="text-4xl md:text-6xl font-black text-white tracking-tight">Ready to modernize?</h2>
                    <p className="text-xl text-slate-300 max-w-2xl mx-auto">Join healthcare providers delivering better patient care with HospitechVerse.</p>
                    <button
                        onClick={() => document.getElementById('plans-section')?.scrollIntoView({ behavior: 'smooth' })}
                        className="px-12 py-5 bg-white text-indigo-900 font-bold rounded-full text-xl hover:bg-indigo-50 transition-all shadow-2xl hover:shadow-white/20 active:scale-95"
                    >
                        View Enterprise Plans
                    </button>
                </div>
            </section>

            {/* Modals */}
            {showBuyModal && (
                <PlanPurchaseModal plan={selectedPlan} open={showBuyModal} onClose={(data) => { setShowBuyModal(false); setSelectedPlan(null); if (data) navigate('/director/queryforplan'); }} />
            )}
            {showCustomizeModal && (
                <CustomizedPlanRequestModal open={showCustomizeModal} onClose={(submitted) => { setShowCustomizeModal(false); if (submitted) toast.success('Request submitted'); }} />
            )}
        </main>
    )
}

