import React from 'react'
import { motion } from 'framer-motion'

const StatsCard = React.memo(function StatsCard({ label, value, icon: Icon, color, bg, loading }) {
    if (loading) {
        return (
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 animate-pulse">
                <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 bg-slate-100 rounded-lg"></div>
                    <div className="h-4 w-12 bg-slate-100 rounded"></div>
                </div>
                <div className="space-y-2">
                    <div className="h-8 w-24 bg-slate-100 rounded"></div>
                    <div className="h-4 w-16 bg-slate-100 rounded"></div>
                </div>
            </div>
        )
    }

    return (
        <motion.div
            whileHover={{ y: -4 }}
            className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 transition-shadow hover:shadow-md relative overflow-hidden group"
        >
            <div className={`absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity ${color}`}>
                <Icon size={64} />
            </div>

            <div className="flex flex-col relative z-10">
                <div className={`w-12 h-12 rounded-xl ${bg} ${color} flex items-center justify-center mb-4 shadow-sm`}>
                    <Icon size={24} />
                </div>
                <div className="text-3xl font-bold text-slate-800 mb-1 tracking-tight">
                    {value}
                </div>
                <div className="text-sm font-medium text-slate-500">
                    {label}
                </div>
            </div>
        </motion.div>
    )
})

export default StatsCard
