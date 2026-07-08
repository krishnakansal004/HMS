import Header from './Header'
import Sidebar from './Sidebar'
import { SidebarProvider } from '../context/SidebarContext'
import ChatbotEmbed from './ChatbotEmbed'

export default function Layout({ children }) {
    return (
        <SidebarProvider>
            <div className="app-shell min-h-screen bg-slate-100 font-inter flex flex-col">
                <Header />
                <div className="flex-1 flex">
                    <Sidebar />
                    <div className="flex flex-col flex-1 md:ml-64 w-full min-h-0">
                        <main className="app-main flex-grow p-3 sm:p-4 md:p-6 pb-8">
                            {children}
                        </main>
                        <footer className="w-full h-14 sm:h-16 flex items-center justify-center text-xs sm:text-sm text-slate-600 bg-blue-50 border-t border-blue-200 px-2 mt-auto">
                            <span className="truncate">© 2025 HMS. All Rights Reserved.</span>
                        </footer>
                    </div>
                </div>
                <ChatbotEmbed />
            </div>
        </SidebarProvider>
    )
}
