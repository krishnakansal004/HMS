import { useProfileRender } from '../utils/profiler';
import React from 'react'
import { motion } from 'framer-motion'
import { User, ClipboardList, Calendar, Bed, Pill, Activity, ShieldCheck, Stethoscope, Microscope, Truck } from 'lucide-react'

export default function Features() {
    useProfileRender('Features', true);
    const modules = [
        {
            title: 'Complete Doctor Workbench',
            desc: 'Manage profiles, schedules, leaves, and consultation fees. Doctors get a dedicated dashboard for appointments and patient history.',
            icon: Stethoscope,
            color: 'bg-blue-500',
            items: ['Smart Scheduling', 'Digital Prescriptions', 'Telemedicine Integration']
        },
        {
            title: 'Patient Lifecycle Management',
            desc: 'From registration (OPD/IPD) to discharge. Track medical history, lab reports, and vitals in a secure, unified timeline.',
            icon: User,
            color: 'bg-emerald-500',
            items: ['EHR/EMR', 'Vitals Tracking', 'Document Uploads']
        },
        {
            title: 'Smart Appointments & Queue',
            desc: 'Eliminate chaos with token-based queuing. SMS/WhatsApp reminders reduce no-shows. Walk-in and online booking supported.',
            icon: Calendar,
            color: 'bg-indigo-500',
            items: ['Live Queue Status', 'Auto-Reminders', 'Walk-in Kiosk Mode']
        },
        {
            title: 'Pharmacy & Inventory',
            desc: 'Real-time stock tracking with low-inventory alerts. Link prescriptions directly to pharmacy for faster dispensing.',
            icon: Pill,
            color: 'bg-rose-500',
            items: ['Batch Tracking', 'Expiry Alerts', 'Digital Billing']
        },
        {
            title: 'Ward & Bed Management',
            desc: 'Visual bed map for real-time occupancy tracking. Manage admissions, transfers, and discharges seamlessly.',
            icon: Bed,
            color: 'bg-amber-500',
            items: ['Occupancy Heatmap', 'Discharge Planning', 'Nurse Station View']
        },
        {
            title: 'Advanced Diagnostics',
            desc: 'Integrated pathology and radiology workflows. Upload reports directly to patient profiles for instant access.',
            icon: Microscope,
            color: 'bg-fuchsia-500',
            items: ['Lab Integration', 'Digital Reports', 'Sample Tracking']
        },
        {
            title: 'Ambulance & Transport',
            desc: 'Manage fleet availability and dispatch. Track ambulance trips and integrate costs directly into patient billing.',
            icon: Truck,
            color: 'bg-orange-500',
            items: ['Fleet Tracking', 'Trip Billing', 'Driver Management']
        },
        {
            title: 'Secure & Compliant',
            desc: 'Role-based access control (RBAC) ensures data security. Audit trails for every action to maintain compliance.',
            icon: ShieldCheck,
            color: 'bg-slate-600',
            items: ['Data Encryption', 'Audit Logs', 'Auto-Backups']
        }
    ]

    const container = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1
            }
        }
    }

    const item = {
        hidden: { y: 20, opacity: 0 },
        show: { y: 0, opacity: 1 }
    }

    return (
        <div className="min-h-screen bg-slate-50 py-24 px-6 lg:px-16 selection:bg-indigo-100 selection:text-indigo-900">
            <div className="max-w-7xl mx-auto">
                <div className="text-center max-w-4xl mx-auto mb-20">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="inline-block mb-6 px-4 py-1.5 rounded-full bg-indigo-50 text-indigo-700 font-bold text-sm tracking-widest uppercase"
                    >
                        Our Capabilities
                    </motion.div>
                    <motion.h1
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-5xl md:text-6xl font-black text-slate-900 tracking-tight leading-tight"
                    >
                        Powerful Modules for <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">Modern Healthcare</span>
                    </motion.h1>
                    <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.2 }}
                        className="mt-8 text-xl text-slate-600 leading-relaxed max-w-2xl mx-auto"
                    >
                        HospitechVerse is a comprehensive ecosystem covering every aspect of hospital operations. Modular, scalable, and designed for speed.
                    </motion.p>
                </div>

                <motion.div
                    variants={container}
                    initial="hidden"
                    animate="show"
                    className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8"
                >
                    {modules.map((m, idx) => (
                        <motion.div
                            key={m.title}
                            variants={item}
                            whileHover={{ y: -8 }}
                            className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-xl shadow-slate-200/50 hover:shadow-2xl hover:shadow-indigo-500/10 hover:border-indigo-100 transition-all duration-300 group overflow-hidden relative"
                        >
                            {/* Decorative Background Blob */}
                            <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${m.color.replace('bg-', 'from-')} to-white opacity-[0.08] -mr-10 -mt-10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500`} />

                            <div className={`w-14 h-14 rounded-2xl ${m.color} text-white flex items-center justify-center shadow-lg shadow-indigo-500/20 mb-6 relative z-10 group-hover:scale-110 transition-transform duration-300`}>
                                <m.icon size={26} strokeWidth={2.5} />
                            </div>

                            <h3 className="text-xl font-bold text-slate-900 mb-3 relative z-10 group-hover:text-indigo-700 transition-colors">{m.title}</h3>
                            <p className="text-slate-600 leading-relaxed mb-8 relative z-10 h-20 text-sm font-medium">{m.desc}</p>

                            <div className="space-y-2.5 relative z-10">
                                {m.items.map((it, i) => (
                                    <div key={i} className="flex items-center gap-2.5 text-xs font-bold text-slate-600 bg-slate-50 px-3 py-2 rounded-lg border border-slate-100/50 group-hover:bg-white group-hover:shadow-sm transition-all">
                                        <div className={`w-2 h-2 rounded-full ${m.color}`}></div>
                                        {it}
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    ))}
                </motion.div>
            </div>
        </div>
    )
}

