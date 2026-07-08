import { useProfileRender } from '../utils/profiler';
import React from "react";
import { motion } from "framer-motion";
import { User, ClipboardList, Calendar, Bed, Box, CheckCircle, Activity, Heart, Shield } from "lucide-react";

export default function About() {
    useProfileRender('About', true);
    return (
        <div className="min-h-screen bg-slate-50 pt-16 pb-24 px-6 lg:px-16 space-y-32 font-sans selection:bg-indigo-100 selection:text-indigo-900">
            {/* Hero Section */}
            <section className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
                <motion.div
                    initial={{ opacity: 0, x: -50 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                >
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-50 text-indigo-700 text-sm font-bold tracking-widest uppercase mb-8 border border-indigo-100/50">
                        <Heart size={14} className="fill-indigo-500 text-indigo-500" />
                        <span>Trusted Healthcare Partner</span>
                    </div>
                    <h1 className="text-5xl md:text-6xl lg:text-7xl font-black text-slate-900 leading-[1.1] tracking-tight mb-8">
                        Transforming <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">Healthcare</span> Operations
                    </h1>
                    <p className="text-xl text-slate-600 leading-relaxed font-medium max-w-lg">
                        HospitechVerse is built for speed, security, and scalability. We empower hospitals to focus on what matters most — <strong className="text-slate-900">saving lives</strong>.
                    </p>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.8, delay: 0.2 }}
                    className="relative"
                >
                    <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-[2.5rem] opacity-20 blur-3xl transform rotate-6 scale-90"></div>
                    <div className="relative bg-white/80 backdrop-blur-xl rounded-[2.5rem] p-10 shadow-2xl border border-white/50 grid grid-cols-2 gap-6">
                        {[
                            { value: '24+', label: 'Active Hospitals', color: 'text-indigo-600' },
                            { value: '18k+', label: 'Patients Served', color: 'text-emerald-600' },
                            { value: '99.9%', label: 'Uptime SLA', color: 'text-amber-500' },
                            { value: '24/7', label: 'Support', color: 'text-rose-500' },
                        ].map((stat, i) => (
                            <div key={i} className="text-center p-8 bg-white rounded-3xl shadow-lg shadow-slate-200/50 border border-slate-100 hover:scale-105 transition-transform duration-300">
                                <div className={`text-5xl font-black ${stat.color} mb-2 tracking-tighter`}>{stat.value}</div>
                                <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">{stat.label}</div>
                            </div>
                        ))}
                    </div>
                </motion.div>
            </section>

            {/* Mission / Values */}
            <section className="max-w-7xl mx-auto">
                <div className="text-center mb-20">
                    <h2 className="text-4xl font-black text-slate-900 tracking-tight">Our Core Philosophy</h2>
                    <p className="text-xl text-slate-600 mt-6 max-w-2xl mx-auto font-medium">We believe hospital software shouldn't be clunky. It should be intuitive, fast, and secure by default.</p>
                </div>

                <div className="grid md:grid-cols-3 gap-8">
                    {[
                        { title: 'Clinical Precision', desc: 'Workflows designed by doctors for doctors. Minimize clicks, maximize care.', icon: Activity },
                        { title: 'Data Security', desc: 'Enterprise-grade encryption and role-based access to protect sensitive patient data.', icon: Shield },
                        { title: 'Patient First', desc: 'Everything we build ultimately aims to improve the patient experience and outcome.', icon: Heart }
                    ].map((item, i) => (
                        <motion.div
                            key={i}
                            whileHover={{ y: -10 }}
                            className="bg-white p-10 rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-slate-100 text-center hover:shadow-2xl hover:shadow-indigo-500/10 transition-all duration-300"
                        >
                            <div className="w-20 h-20 bg-indigo-50 rounded-3xl flex items-center justify-center mx-auto mb-8 text-indigo-600 shadow-inner">
                                <item.icon size={36} strokeWidth={2} />
                            </div>
                            <h3 className="text-2xl font-bold text-slate-900 mb-4">{item.title}</h3>
                            <p className="text-slate-600 leading-relaxed font-medium">{item.desc}</p>
                        </motion.div>
                    ))}
                </div>
            </section>

            {/* Modules Grid */}
            <section className="max-w-7xl mx-auto">
                <div className="bg-slate-900 rounded-[3rem] p-12 lg:p-20 text-white overflow-hidden relative shadow-2xl shadow-indigo-900/40">
                    {/* Abstract Background */}
                    <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-indigo-600/30 rounded-full blur-[100px] -mr-40 -mt-40 pointer-events-none"></div>
                    <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-purple-600/20 rounded-full blur-[100px] -ml-40 -mb-40 pointer-events-none"></div>

                    <div className="relative z-10 grid lg:grid-cols-2 gap-16 items-center">
                        <div className="space-y-8">
                            <h2 className="text-4xl md:text-5xl font-black tracking-tight leading-tight">A Complete Ecosystem</h2>
                            <p className="text-indigo-200 text-lg leading-relaxed max-w-lg">
                                From the front desk to the OT, HospitechVerse connects every department in real-time. Say goodbye to silos and hello to seamless synchronization.
                            </p>
                            <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {['OPD & IPD Management', 'Pharmacy & Inventory', 'HR & Payroll', 'Laboratory (LIS)', 'Ambulance & Transport', 'Telemedicine'].map((m) => (
                                    <li key={m} className="flex items-center gap-3 text-lg font-medium text-white/90">
                                        <div className="p-1 rounded-full bg-emerald-500/20 text-emerald-400">
                                            <CheckCircle size={16} strokeWidth={3} />
                                        </div>
                                        {m}
                                    </li>
                                ))}
                            </ul>
                            <button className="inline-block mt-8 px-10 py-4 bg-white text-indigo-900 font-bold rounded-full hover:bg-indigo-50 transition shadow-lg active:scale-95">
                                Explore All Features
                            </button>
                        </div>

                        <div className="grid grid-cols-2 gap-6 scale-95 lg:scale-100">
                            {[ClipboardList, User, Box, Calendar].map((Icon, i) => (
                                <div key={i} className={`p-8 rounded-[2rem] bg-white/5 backdrop-blur-md border border-white/10 flex items-center justify-center aspect-square ${i % 2 !== 0 ? 'mt-12' : 'mb-12'} hover:bg-white/10 transition-colors cursor-default`}>
                                    <Icon size={56} className="text-indigo-300 drop-shadow-lg" />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}

