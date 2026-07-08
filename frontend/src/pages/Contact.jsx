import { useProfileRender } from '../utils/profiler';
import React, { useState } from 'react'
import { submitContactQuery } from '../services/api'
import { toast } from 'react-toastify'
import { Mail, Phone, MessageSquare, Clock, MapPin, Send } from 'lucide-react'
import { motion } from 'framer-motion'

export default function Contact() {
    useProfileRender('Contact', true);
    const [form, setForm] = useState({ name: '', email: '', phone: '', message: '' })
    const [loading, setLoading] = useState(false)

    const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value })

    async function onSubmit(e) {
        e.preventDefault()
        if (!form.name || !form.email || !form.message) {
            toast.error('Please fill in your name, email and query')
            return
        }
        try {
            setLoading(true)
            await submitContactQuery(form)
            toast.success('Thanks! We have received your query.')
            setForm({ name: '', email: '', phone: '', message: '' })
        } catch (e) {
            // toasts handled in api layer
        } finally { setLoading(false) }
    }

    return (
        <div className="min-h-screen bg-slate-50 pt-16 pb-24 px-6 lg:px-16 flex flex-col items-center font-sans selection:bg-indigo-100 selection:text-indigo-900">

            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center max-w-3xl mx-auto mb-20"
            >
                <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-bold bg-indigo-50 text-indigo-700 mb-6 uppercase tracking-widest border border-indigo-100/50">
                    <MessageSquare size={14} /> Get in touch
                </div>
                <h1 className="text-5xl md:text-6xl font-black text-slate-900 tracking-tight leading-tight">
                    Let's Start a <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">Conversation</span>
                </h1>
                <p className="mt-8 text-xl text-slate-600 leading-relaxed max-w-2xl mx-auto font-medium">
                    Have questions about pricing, demos, or features? Our team is ready to help you modernize your healthcare operations.
                </p>
            </motion.div>

            <div className="w-full max-w-7xl grid lg:grid-cols-3 gap-10 lg:gap-16">
                {/* Contact Info Cards */}
                <div className="space-y-6 lg:col-span-1 order-last lg:order-first">
                    {[
                        { icon: Mail, title: 'Email Us', val: 'support@hospitechverse.com', sub: 'We reply within 24 hours', color: 'bg-sky-500', gradient: 'from-sky-400 to-blue-500' },
                        { icon: Phone, title: 'Call Us', val: '+1 (800) 555-0123', sub: 'Mon-Fri, 9am - 6pm EST', color: 'bg-fuchsia-500', gradient: 'from-fuchsia-400 to-pink-500' },
                        { icon: MapPin, title: 'Visit Us', val: 'Tech Park, Sector 5', sub: 'Innovation Hub, Bangalore', color: 'bg-emerald-500', gradient: 'from-emerald-400 to-green-500' }
                    ].map((item, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.1 }}
                            className="bg-white p-8 rounded-[2rem] shadow-lg shadow-slate-200/50 border border-slate-100 flex items-start gap-6 hover:shadow-xl hover:shadow-indigo-500/10 hover:-translate-y-1 transition-all duration-300 group"
                        >
                            <div className={`p-4 rounded-2xl bg-gradient-to-br ${item.gradient} text-white shadow-lg shadow-${item.color}/30 transform group-hover:scale-110 transition-transform duration-300`}>
                                <item.icon size={24} strokeWidth={2.5} />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-900 text-xl mb-1">{item.title}</h3>
                                <p className="text-indigo-600 font-bold transition-colors">{item.val}</p>
                                <p className="text-sm text-slate-500 mt-2 font-medium">{item.sub}</p>
                            </div>
                        </motion.div>
                    ))}
                </div>

                {/* Form Section */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="lg:col-span-2 order-first lg:order-last bg-white rounded-[2.5rem] shadow-2xl shadow-indigo-200/40 border border-slate-100 p-8 md:p-12 relative overflow-hidden"
                >
                    <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-50/80 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none transition-transform hover:scale-110 duration-700"></div>

                    <form onSubmit={onSubmit} className="relative z-10 space-y-8">
                        <div className="grid md:grid-cols-2 gap-8">
                            <div className="space-y-3">
                                <label className="text-sm font-bold text-slate-900 ml-1 uppercase tracking-wide">Full Name</label>
                                <input
                                    name="name"
                                    value={form.name}
                                    onChange={onChange}
                                    className="w-full px-6 py-4 rounded-2xl bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-medium text-slate-700 placeholder:text-slate-400"
                                    placeholder="John Doe"
                                    required
                                />
                            </div>
                            <div className="space-y-3">
                                <label className="text-sm font-bold text-slate-900 ml-1 uppercase tracking-wide">Email Address</label>
                                <input
                                    name="email"
                                    type="email"
                                    value={form.email}
                                    onChange={onChange}
                                    className="w-full px-6 py-4 rounded-2xl bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-medium text-slate-700 placeholder:text-slate-400"
                                    placeholder="john@company.com"
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-3">
                            <label className="text-sm font-bold text-slate-900 ml-1 uppercase tracking-wide">Phone Number (Optional)</label>
                            <input
                                name="phone"
                                value={form.phone}
                                onChange={onChange}
                                className="w-full px-6 py-4 rounded-2xl bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-medium text-slate-700 placeholder:text-slate-400"
                                placeholder="+1 (555) 000-0000"
                            />
                        </div>

                        <div className="space-y-3">
                            <label className="text-sm font-bold text-slate-900 ml-1 uppercase tracking-wide">How can we help?</label>
                            <textarea
                                name="message"
                                rows={5}
                                value={form.message}
                                onChange={onChange}
                                className="w-full px-6 py-4 rounded-2xl bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all resize-none font-medium text-slate-700 placeholder:text-slate-400"
                                placeholder="Tell us about your requirements..."
                                required
                            />
                        </div>

                        <button
                            disabled={loading}
                            className="w-full py-5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-bold rounded-2xl shadow-xl shadow-indigo-500/30 hover:shadow-indigo-600/40 transition-all active:scale-[0.98] flex items-center justify-center gap-3 text-lg"
                        >
                            {loading ? (
                                <span className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                            ) : (
                                <>Send Message <Send size={20} /></>
                            )}
                        </button>
                    </form>
                </motion.div>
            </div>
        </div>
    )
}

