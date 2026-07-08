import { Outlet, useLocation } from 'react-router-dom'
import PublicNavbar from './PublicNavbar'
import ChatbotEmbed from './ChatbotEmbed'

export default function PublicLayout() {
    const location = useLocation()
    const hideTopPadding = location.pathname === '/' || location.pathname === '/home'

    return (
        <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-100 to-slate-200">
            <PublicNavbar />
            <main className={`flex-1 w-full px-3 sm:px-4 md:px-8 lg:px-12 ${hideTopPadding ? 'pt-0' : 'pt-16 sm:pt-20 md:pt-24'} pb-12 sm:pb-16`}>
                <Outlet />
            </main>
            <footer className="mt-auto py-4 sm:py-6 text-center text-xs text-slate-500 px-3">
                © {new Date().getFullYear()} HOSPITECHVERSE • Developed by <span className="font-semibold">IITianCraft</span>
            </footer>
            <ChatbotEmbed />
        </div>
    )
}
