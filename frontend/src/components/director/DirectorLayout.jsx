import React from 'react'
import DirectorHeader from './DirectorHeader'
import DirectorSidebar from './DirectorSidebar'
import ChatbotEmbed from '../ChatbotEmbed'
import { SidebarProvider } from '../../context/SidebarContext'

export default function DirectorLayout({ children }) {
    return (
        <SidebarProvider>
            <div className="min-h-screen bg-slate-50/50">
                {/* fixed sidebar */}
                <DirectorSidebar />

                {/* Main content wrapper */}
                <div className="lg:pl-72 transition-all duration-300">
                    {/* fixed header inside the wrapper so it pushes with sidebar? No, header is fixed full width on mobile, and offset on desktop. */}
                    <DirectorHeader />

                    {/* Main scrollable content area */}
                    <main className="pt-20 p-4 sm:p-6 lg:p-8 min-h-screen">
                        <div className="max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
                            {children}
                        </div>
                    </main>

                    {/* Footer can go here if needed */}
                    <ChatbotEmbed />
                </div>
            </div>
        </SidebarProvider>
    )
}
