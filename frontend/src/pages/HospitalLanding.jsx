import { useProfileRender } from '../utils/profiler';
import { useState, useEffect, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useSuspenseQuery } from '@tanstack/react-query'
import { getPublicTenant, listPublicDoctors } from '../services/api'
import { ArrowRight, Stethoscope, User, ShieldCheck, MapPin, Phone, Mail, Instagram, Facebook, Twitter, Linkedin, Star, Clock, CheckCircle } from 'lucide-react'
import { motion } from 'framer-motion'
import { useInView } from 'react-intersection-observer'
import TenantLoginModal from '../components/TenantLoginModal'
import TenantSignupModal from '../components/TenantSignupModal'
import DoctorApplyModal from '../components/DoctorApplyModal'

const Section = ({ children, className = "" }) => {
    const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.1 })
    return (
        <motion.div
            ref={ref}
            initial={{ opacity: 0, y: 30 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6 }}
            className={className}
        >
            {children}
        </motion.div>
    )
}

export default function HospitalLanding() {
    useProfileRender('HospitalLanding', true);
    const { hospitalSlug } = useParams()
    const [showLogin, setShowLogin] = useState(false)
    const [showSignup, setShowSignup] = useState(false)
    const [showApplyDoctor, setShowApplyDoctor] = useState(false)

    const { data: landingData } = useSuspenseQuery({
        queryKey: ['hospitalLandingData', hospitalSlug],
        queryFn: async () => {
            try {
                const hospital = await getPublicTenant(hospitalSlug)
                let doctors = []
                if (hospital?.publicProfile?.showDoctors) {
                    try {
                        doctors = await listPublicDoctors(hospitalSlug)
                    } catch (e) {
                        console.error('Failed to list public doctors', e)
                    }
                }
                return { hospital, doctors, error: null }
            } catch (err) {
                return { hospital: null, doctors: [], error: 'Hospital portal not found' }
            }
        }
    })

    const { hospital, doctors: docsData, error } = landingData
    const doctors = useMemo(() => (docsData || []).slice(0, 4), [docsData])

    if (error || !hospital) return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4 font-sans">
            <div className="text-center max-w-md">
                <h1 className="text-6xl font-black text-slate-200 mb-4">404</h1>
                <h2 className="text-2xl font-bold text-slate-800 mb-2">Portal Unavailable</h2>
                <p className="text-slate-500 mb-8">The hospital portal you are looking for does not exist or has been moved.</p>
                <Link to="/" className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-slate-900 hover:bg-slate-800 transition-all">
                    Go to Main Platform
                </Link>
            </div>
        </div>
    )

    const profile = hospital.publicProfile || {}
    const themeColor = profile.themeColor || '#2563eb'
    const social = profile.socialLinks || {}

    return (
        <div className="min-h-screen font-sans bg-white selection:bg-slate-900 selection:text-white">
            {/* Navbar */}
            <nav className="fixed w-full z-50 bg-white/90 backdrop-blur-md border-b border-slate-100 transition-all">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-20">
                        {/* Branding */}
                        <div className="flex items-center gap-3">
                            {profile.logoUrl ? (
                                <img src={profile.logoUrl} alt="Logo" className="h-10 w-auto object-contain" />
                            ) : (
                                <div className="h-10 w-10 bg-slate-900 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-lg">
                                    {hospital.name[0]}
                                </div>
                            )}
                            <div className="hidden sm:flex flex-col">
                                <span className="font-bold text-xl text-slate-900 tracking-tight">{hospital.name}</span>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-4">
                            <button onClick={() => setShowApplyDoctor(true)} className="hidden md:inline-flex text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors">
                                Apply as Doctor
                            </button>
                            <button onClick={() => setShowLogin(true)} className="hidden md:inline-flex text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors">
                                Log in
                            </button>
                            <button
                                onClick={() => setShowSignup(true)}
                                className="px-6 py-2.5 rounded-full font-semibold bg-slate-900 text-white hover:bg-slate-800 hover:shadow-lg hover:shadow-slate-200 transition-all flex items-center gap-2 text-sm"
                                style={{ backgroundColor: themeColor }}
                            >
                                Book Appointment
                            </button>
                        </div>
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <header className="relative pt-32 pb-40 lg:min-h-screen flex items-center overflow-hidden">
                <div className="absolute inset-0 z-0">
                    <img
                        src={profile.heroImageUrl || 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?ixlib=rb-1.2.1&auto=format&fit=crop&w=2850&q=80'}
                        alt="Hospital Cover"
                        className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-r from-slate-900/90 to-slate-900/40"></div>
                </div>

                <div className="container relative mx-auto px-4 z-10">
                    <div className="max-w-3xl">
                        <motion.div
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.8 }}
                        >
                            <span
                                className="inline-block px-4 py-1.5 rounded-full bg-white/10 backdrop-blur border border-white/20 text-white text-sm font-medium mb-6"
                            >
                                Welcome to Premium Healthcare
                            </span>
                            <h1 className="text-3xl sm:text-4xl md:text-7xl font-bold text-white mb-6 md:mb-8 leading-tight tracking-tight">
                                {profile.landingTitle || `Care That \nRevolves Around You.`}
                            </h1>
                            <p className="text-base md:text-xl text-slate-200 mb-8 md:mb-10 leading-relaxed max-w-2xl font-light">
                                {profile.landingDescription || "Experience world-class medical services with a personal touch. Advanced technology, expert specialists, and compassionate care waiting for you."}
                            </p>

                            <div className="flex flex-col sm:flex-row gap-4">
                                <button
                                    onClick={() => setShowSignup(true)}
                                    className="px-8 py-4 bg-white text-slate-900 font-bold rounded-full hover:bg-slate-100 transition-all flex items-center justify-center gap-2 shadow-xl shadow-white/10"
                                >
                                    Get Started <ArrowRight size={20} />
                                </button>
                                <button
                                    onClick={() => setShowApplyDoctor(true)}
                                    className="px-8 py-4 bg-transparent border border-white/30 text-white font-bold rounded-full hover:bg-white/10 transition-all flex items-center justify-center gap-2 backdrop-blur-sm"
                                >
                                    Apply as Doctor
                                </button>
                            </div>
                        </motion.div>
                    </div>
                </div>
            </header>

            {/* Quick Stats / Features */}
            <section className="relative -mt-24 z-20 pb-20">
                <div className="container mx-auto px-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
                        {[
                            { icon: ShieldCheck, title: "Secure Records", desc: "Encrypted medical history accessible 24/7." },
                            { icon: Clock, title: "Instant Booking", desc: "No waiting lines. Book appointments in seconds." },
                            { icon: Stethoscope, title: "Expert Care", desc: "Consult with top-tier specialists directly." }
                        ].map((item, i) => (
                            <Section key={i} className="bg-white p-6 md:p-8 rounded-2xl md:rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 hover:-translate-y-1 transition-transform duration-300">
                                <div className="w-12 h-12 md:w-14 md:h-14 rounded-xl md:rounded-2xl bg-slate-50 text-slate-900 flex items-center justify-center mb-4 md:mb-6" style={{ color: themeColor }}>
                                    <item.icon size={24} className="md:w-[28px] md:h-[28px]" />
                                </div>
                                <h3 className="text-lg md:text-xl font-bold text-slate-900 mb-2 md:mb-3">{item.title}</h3>
                                <p className="text-sm md:text-base text-slate-500 leading-relaxed">{item.desc}</p>
                            </Section>
                        ))}
                    </div>
                </div>
            </section>

            {/* Amenities Gallery */}
            {profile.gallery && profile.gallery.length > 0 && (
                <section className="py-24 bg-slate-50">
                    <div className="container mx-auto px-4">
                        <Section className="text-center max-w-3xl mx-auto mb-16">
                            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-6">World-Class Facilities</h2>
                            <p className="text-slate-500 text-lg">Designed for your comfort and recovery.</p>
                        </Section>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 h-[600px] md:h-[400px]">
                            {profile.gallery.slice(0, 5).map((img, i) => (
                                <div key={i} className={`relative overflow-hidden rounded-3xl group ${i === 0 ? 'md:col-span-2 md:row-span-2' : ''}`}>
                                    <img src={img} alt="Facility" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300" />
                                </div>
                            ))}
                        </div>
                    </div>
                </section>
            )}

            {/* Why Choose Us */}
            <section className="py-24">
                <div className="container mx-auto px-4">
                    <div className="grid lg:grid-cols-2 gap-16 items-center">
                        <Section>
                            <img
                                src="https://images.unsplash.com/photo-1631217868264-e5b90bb7e133?ixlib=rb-1.2.1&auto=format&fit=crop&w=2000&q=80"
                                alt="Modern Interior"
                                className="rounded-[2.5rem] shadow-2xl shadow-slate-200"
                            />
                        </Section>
                        <Section>
                            <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-8 leading-tight">Redefining the standard of healthcare.</h2>
                            <p className="text-lg text-slate-500 mb-8 leading-relaxed">
                                We believe in a holistic approach to medicine, combining state-of-the-art technology with compassionate care. Our facilities are designed to promote healing and provide a seamless experience for patients and families.
                            </p>

                            <div className="space-y-4 mb-10">
                                {profile.amenities && profile.amenities.length > 0 ? profile.amenities.map(a => (
                                    <div key={a} className="flex items-center gap-3 text-slate-700 font-medium">
                                        <CheckCircle size={20} className="text-emerald-500" />
                                        {a}
                                    </div>
                                )) : (
                                    <>
                                        {["Advanced Diagnostic Lab", "24/7 Emergency Support", "Digital Health Records", "Telemedicine Support"].map(a => (
                                            <div key={a} className="flex items-center gap-3 text-slate-700 font-medium">
                                                <CheckCircle size={20} className="text-emerald-500" />
                                                {a}
                                            </div>
                                        ))}
                                    </>
                                )}
                            </div>

                            <Link to="about" className="text-slate-900 font-bold hover:opacity-70 transition-opacity inline-flex items-center gap-2 border-b-2 border-slate-900 pb-1">
                                Learn more about us <ArrowRight size={18} />
                            </Link>
                        </Section>
                    </div>
                </div>
            </section>

            {/* Doctors */}
            {profile.showDoctors !== false && doctors.length > 0 && (
                <section className="py-24 bg-slate-50">
                    <div className="container mx-auto px-4">
                        <Section className="flex justify-between items-end mb-12">
                            <div>
                                <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">Meet Our Specialists</h2>
                                <p className="text-slate-500">Experienced professionals dedicated to your health.</p>
                            </div>
                            <Link to="doctors-public" className="hidden md:inline-flex items-center gap-2 font-semibold text-slate-600 hover:text-slate-900">
                                View all doctors <ArrowRight size={18} />
                            </Link>
                        </Section>

                        <div className="grid md:grid-cols-4 gap-6">
                            {doctors.map(doc => (
                                <Section key={doc._id} className="bg-white p-4 rounded-3xl group cursor-pointer hover:shadow-xl transition-all duration-300">
                                    <div className="aspect-[4/5] overflow-hidden rounded-2xl mb-4 bg-slate-100 relative">
                                        <img
                                            src={doc.avatarUrl || `https://ui-avatars.com/api/?name=${doc.name}&background=random`}
                                            alt={doc.name}
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                        />
                                        <div className="absolute top-3 right-3 bg-white/90 backdrop-blur px-2 py-1 rounded-lg text-xs font-bold shadow-sm flex items-center gap-1">
                                            <Star size={12} className="text-amber-400 fill-amber-400" />
                                            4.9
                                        </div>
                                    </div>
                                    <h3 className="font-bold text-lg text-slate-900 mb-1">{doc.name}</h3>
                                    <p className="text-slate-500 text-sm mb-4">{doc.specialization || "General Medicine"}</p>
                                    <button onClick={() => setShowSignup(true)} className="w-full py-3 rounded-xl bg-slate-50 text-slate-900 font-semibold text-sm hover:bg-slate-900 hover:text-white transition-colors flex items-center justify-center">
                                        Book Visit
                                    </button>
                                </Section>
                            ))}
                        </div>
                    </div>
                </section>
            )}

            {/* CTA / Footer */}
            <footer className="bg-slate-900 text-white pt-24 pb-12">
                <div className="container mx-auto px-4">
                    <div className="grid md:grid-cols-4 gap-12 mb-20 border-b border-white/10 pb-12">
                        <div className="md:col-span-2 pr-8">
                            {profile.logoUrl ? (
                                <img src={profile.logoUrl} alt="Logo" className="h-12 w-auto object-contain mb-8 filter brightness-0 invert" />
                            ) : (
                                <div className="text-3xl font-bold mb-8">{hospital.name}</div>
                            )}
                            <p className="text-slate-400 text-lg leading-relaxed max-w-md mb-8">
                                Providing exceptional care and accessible medical services to our community. Your health is our priority.
                            </p>
                            <div className="flex gap-4">
                                {[
                                    { k: 'facebook', icon: Facebook },
                                    { k: 'twitter', icon: Twitter },
                                    { k: 'instagram', icon: Instagram },
                                    { k: 'linkedin', icon: Linkedin }
                                ].map(({ k, icon: Icon }) => social[k] && (
                                    <a key={k} href={social[k]} target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white hover:text-slate-900 transition-all">
                                        <Icon size={18} />
                                    </a>
                                ))}
                            </div>
                        </div>

                        <div>
                            <h4 className="font-bold text-lg mb-6">Contact</h4>
                            <div className="space-y-4 text-slate-400">
                                <div className="flex items-start gap-4">
                                    <MapPin className="shrink-0 mt-1" size={20} />
                                    <span>{profile.address || 'Address not listed'}</span>
                                </div>
                                <div className="flex items-center gap-4">
                                    <Phone className="shrink-0" size={20} />
                                    <span>{profile.contactPhone || 'Phone not listed'}</span>
                                </div>
                                <div className="flex items-center gap-4">
                                    <Mail className="shrink-0" size={20} />
                                    <span>{profile.contactEmail || 'Email not listed'}</span>
                                </div>
                            </div>
                        </div>

                        <div>
                            <h4 className="font-bold text-lg mb-6">Links</h4>
                            <ul className="space-y-3 text-slate-400">
                                <li><button onClick={() => setShowLogin(true)} className="hover:text-white transition-colors text-left">Patient Login</button></li>
                                <li><button onClick={() => setShowSignup(true)} className="hover:text-white transition-colors text-left">New Registration</button></li>
                                <li><button onClick={() => setShowApplyDoctor(true)} className="hover:text-white transition-colors text-left">Apply as Doctor</button></li>
                                <li><Link to="/" className="hover:text-white transition-colors">Main Platform</Link></li>
                            </ul>
                        </div>
                    </div>

                    <div className="text-center text-slate-500 text-sm">
                        <p>&copy; {new Date().getFullYear()} {hospital.name}. All rights reserved.</p>
                    </div>
                </div>
            </footer>

            <TenantLoginModal
                open={showLogin}
                onClose={() => setShowLogin(false)}
                themeColor={themeColor}
                logoUrl={profile.logoUrl}
                hospitalName={hospital.name}
            />
            <TenantSignupModal
                open={showSignup}
                onClose={() => setShowSignup(false)}
                themeColor={themeColor}
                logoUrl={profile.logoUrl}
                hospitalName={hospital.name}
            />
            <DoctorApplyModal
                open={showApplyDoctor}
                onClose={() => setShowApplyDoctor(false)}
                hospitalSlug={hospitalSlug}
                themeColor={themeColor}
            />
        </div>
    )
}

