export default function Logo({ size = 22, withText = false, text = 'HOSPITECHVERSE' }) {
    const s = Number(size)
    return (
        <div className="flex items-center gap-2 select-none">
            <svg
                width={s}
                height={s}
                viewBox="0 0 48 48"
                xmlns="http://www.w3.org/2000/svg"
                aria-label="HMS logo"
                role="img"
            >
                <defs>
                    <linearGradient id="hmsGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#0ea5e9" />
                        <stop offset="100%" stopColor="#22d3ee" />
                    </linearGradient>
                    <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
                        <feDropShadow dx="1" dy="3" stdDeviation="2.5" floodColor="#0ea5e933" />
                    </filter>
                </defs>
                <g filter="url(#softShadow)">
                    <rect x="6" y="6" width="36" height="36" rx="8" ry="8" fill="url(#hmsGradient)" />
                </g>
                <path
                    fill="#fff"
                    d="M24,14c-5.523,0-10,4.477-10,10s4.477,10,10,10s10-4.477,10-10S29.523,14,24,14z M28,25h-3v3h-2v-3h-3v-2h3v-3h2v3h3V25z"
                />
                <path
                    fill="none"
                    stroke="#fff"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity="0.5"
                    d="M16,32c2.5-1.5,5.5-2.5,9-2.5s6.5,1,9,2.5"
                />
            </svg>
            {withText && (
                <span className="text-lg font-semibold tracking-tight text-slate-800">{text}</span>
            )}
        </div>
    )
}
