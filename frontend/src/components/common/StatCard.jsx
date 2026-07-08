import React from 'react'

export default function StatCard({
    label,
    value,
    subtitle,
    icon: Icon,
    // Option 1: Tailwind classes
    iconColor,
    iconBg,
    // Option 2: Hex color (overrides classes if provided)
    color,
    onClick,
    action,
    loading
}) {
    // Determine styles
    let computedIconColor = iconColor || 'text-slate-600'
    let computedIconBg = iconBg || 'bg-slate-50'
    let style = {}

    if (color) {
        // If hex color is provided, use it for text and generic background opacity
        // Note: Tailwind doesn't support dynamic arbitrary values easily without JIT interpolation, 
        // so inline styles are safer for dynamic hexes.
        computedIconColor = '' // Clear class
        computedIconBg = ''   // Clear class
        style = {
            color: color,
            backgroundColor: `${color}20` // 20 starts roughly 12% opacity in hex? No, 20 is like 32/255 ~= 12%
        }
    }

    return (
        <div
            className={`p-5 rounded-xl shadow-sm bg-white border border-slate-100 flex flex-col justify-between h-full transition-all hover:shadow-md ${onClick ? 'cursor-pointer active:scale-[0.98]' : ''}`}
            onClick={onClick}
        >
            <div className="flex items-start justify-between">
                <div>
                    <div className="text-sm font-medium text-slate-500 mb-1">{label}</div>
                    <div className="text-3xl font-bold text-slate-800 tracking-tight">{loading ? '...' : value}</div>
                    {subtitle && <div className="text-xs text-slate-400 mt-2">{subtitle}</div>}
                </div>

                <div
                    className={`p-3 rounded-lg bg-opacity-10 ${computedIconBg} ${computedIconColor}`}
                    style={color ? style : {}}
                >
                    {Icon && <Icon size={24} />}
                </div>
            </div>
            {action && <div className="mt-4">{action}</div>}
        </div>
    )
}
