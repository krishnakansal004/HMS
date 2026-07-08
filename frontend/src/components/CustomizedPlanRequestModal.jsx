import React, { useState } from 'react'
import { toast } from 'react-toastify'
import { X, Copy, CheckCircle } from 'lucide-react'

const ACCEPT_TEXT = `I heareby accept the term and conditions of HOSPITECHVERSE Co-powered by IITIANCRAFT the term AND CONDITION APPLIED AND THAT THE REQUEST IS VALID AND I AM A GENUINE CUSTOMER AND THE REQUEST IS GENUINE AND I WILL CORPORATE THE COMPANY RULES AND REGULATION MY WORDS AND WRITTEN STATEMENT I WILL PROVIDE AFTER THE CONVESATION WITH COMPANY AND IN THAT I WILL GIVE MY ACCEPTANCE AFTER I FINALLY SAY YES FOR PROCEDUREOF CUSTOMIZATION PLAN. THIS THE FORM FILLER CAN COPY AND PASTE ALSO AFTER THAT THE REQUEST WILL BE SUBMIT`

export default function CustomizedPlanRequestModal({ open, onClose }) {
    const [name, setName] = useState('')
    const [email, setEmail] = useState('')
    const [contact, setContact] = useState('')
    const [company, setCompany] = useState('')
    const [address, setAddress] = useState('')
    const [description, setDescription] = useState('')
    const [purpose, setPurpose] = useState('')
    const [priceRange, setPriceRange] = useState('')
    const [period, setPeriod] = useState('')
    const [agree, setAgree] = useState(false)
    const [copiedText, setCopiedText] = useState('')
    const [loading, setLoading] = useState(false)

    if (!open) return null

    function validateEmail(e) {
        return /\S+@\S+\.\S+/.test(e)
    }

    const handleCopy = () => {
        navigator.clipboard.writeText(ACCEPT_TEXT)
        toast.success('Text copied to clipboard!')
    }

    async function onSubmit(e) {
        e.preventDefault()
        if (!name || !email || !contact) return toast.error('Please fill name, email and contact')
        if (!validateEmail(email)) return toast.error('Please enter a valid email')
        if (!agree) return toast.error('Please accept the terms by checking the box')
        if (copiedText.trim() !== ACCEPT_TEXT.trim()) return toast.error('Please copy and paste the acceptance text exactly into the field')

        setLoading(true)
        try {
            const payload = { name, email, contact, company, address, description, purpose, priceRange, period, copiedText, agree }
            const res = await fetch('/api/customization-requests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
            if (!res.ok) {
                const err = await res.json().catch(() => ({}))
                throw new Error(err.error || 'Request failed')
            }
            toast.success('Customization request submitted — directors will review it')
            onClose && onClose(true)
        } catch (err) {
            console.error(err)
            toast.error('Submit failed: ' + (err.message || err))
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gradient-to-r from-gray-50 to-white">
                    <div>
                        <h2 className="text-xl font-bold text-gray-800">Custom Plan Request</h2>
                        <p className="text-sm text-gray-500 mt-1">Tailor a plan specifically for your institution's needs</p>
                    </div>
                    <button
                        onClick={() => onClose && onClose(false)}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="overflow-y-auto p-6 md:p-8">
                    <form onSubmit={onSubmit} className="space-y-8">
                        {/* Section 1: Contact Information */}
                        <section>
                            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-600 text-xs font-bold">1</span>
                                Contact Details
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <InputField label="Full Name" value={name} onChange={setName} placeholder="e.g. Dr. John Doe" />
                                <InputField label="Email Address" value={email} onChange={setEmail} placeholder="john@hospital.com" type="email" />
                                <InputField label="Contact Number" value={contact} onChange={setContact} placeholder="+91 98765 43210" />
                                <InputField label="Institution/Company" value={company} onChange={setCompany} placeholder="City General Hospital" />
                                <div className="md:col-span-2">
                                    <InputField label="Full Address" value={address} onChange={setAddress} placeholder="123 Health Street, Medical District..." />
                                </div>
                            </div>
                        </section>

                        <div className="h-px bg-gray-100 w-full" />

                        {/* Section 2: Requirement Details */}
                        <section>
                            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-600 text-xs font-bold">2</span>
                                Requirements
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Description of Customization</label>
                                    <textarea
                                        value={description}
                                        onChange={e => setDescription(e.target.value)}
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none resize-y min-h-[100px]"
                                        placeholder="Describe the specific features, modules, or limits you need..."
                                    />
                                </div>
                                <InputField label="Purpose of Plan" value={purpose} onChange={setPurpose} placeholder="e.g. Managing multiple clinic branches" />
                                <div className="grid grid-cols-2 gap-4">
                                    <InputField label="Budget Range (Approx)" value={priceRange} onChange={setPriceRange} placeholder="₹50k - ₹1.5L" />
                                    <InputField label="Desired Duration" value={period} onChange={setPeriod} placeholder="e.g. Yearly" />
                                </div>
                            </div>
                        </section>

                        <div className="h-px bg-gray-100 w-full" />

                        {/* Section 3: Legal Disclaimers */}
                        <section className="bg-yellow-50/50 rounded-xl p-5 border border-yellow-100">
                            <h3 className="text-sm font-semibold text-yellow-800 mb-3 uppercase tracking-wider">Declaration</h3>

                            <div className="bg-white border border-yellow-200 rounded-lg p-4 relative group hover:shadow-sm transition-shadow">
                                <p className="text-xs text-gray-600 leading-relaxed font-mono select-all">
                                    {ACCEPT_TEXT}
                                </p>
                                <button
                                    type="button"
                                    onClick={handleCopy}
                                    className="absolute top-2 right-2 p-1.5 bg-gray-50 hover:bg-blue-50 text-gray-400 hover:text-blue-600 rounded transition-colors"
                                    title="Copy Text"
                                >
                                    <Copy size={14} />
                                </button>
                            </div>

                            <div className="mt-4">
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Confirmation Statement
                                    <span className="text-gray-400 font-normal ml-2 text-xs">(Paste the text above here)</span>
                                </label>
                                <textarea
                                    value={copiedText}
                                    onChange={e => setCopiedText(e.target.value)}
                                    className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-yellow-500/20 focus:border-yellow-500 transition-all outline-none text-sm"
                                    rows={3}
                                    placeholder="Paste the declaration text here exactly..."
                                />
                            </div>

                            <div className="mt-4 flex items-center gap-3">
                                <div className="flex items-center h-5">
                                    <input
                                        id="agreeRequest"
                                        type="checkbox"
                                        checked={agree}
                                        onChange={e => setAgree(e.target.checked)}
                                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                    />
                                </div>
                                <label htmlFor="agreeRequest" className="text-sm text-gray-700 cursor-pointer select-none">
                                    I confirm that the details provided are accurate and I agree to the terms.
                                </label>
                            </div>
                        </section>

                        <div className="pt-6 border-t border-gray-100 bg-gray-50 -mx-6 -mb-6 md:-mx-8 md:-mb-8 px-6 md:px-8 py-4 mt-8 rounded-b-2xl">
                            <div className="flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => onClose && onClose(false)}
                                    className="px-5 py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:text-gray-800 transition-colors shadow-sm"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={onSubmit}
                                    disabled={loading || !agree || copiedText.trim() !== ACCEPT_TEXT.trim()}
                                    className={`px-6 py-2.5 text-sm font-medium text-white rounded-lg shadow-lg shadow-blue-500/20 flex items-center gap-2 transition-all transform active:scale-95
                                        ${(loading || !agree || copiedText.trim() !== ACCEPT_TEXT.trim())
                                            ? 'bg-gray-400 cursor-not-allowed shadow-none'
                                            : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 hover:-translate-y-0.5'
                                        }`}
                                >
                                    {loading ? (
                                        <>
                                            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            Submitting...
                                        </>
                                    ) : (
                                        <>
                                            <CheckCircle size={16} />
                                            Submit Request
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
            </div>
        </div >
    )
}

function InputField({ label, value, onChange, type = "text", placeholder }) {
    return (
        <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
            <input
                type={type}
                value={value}
                onChange={e => onChange(e.target.value)}
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none text-gray-800 placeholder:text-gray-400"
                placeholder={placeholder}
            />
        </div>
    )
}
