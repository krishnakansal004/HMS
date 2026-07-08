import { useProfileRender } from '../utils/profiler';
import MarketingCard from '../components/MarketingCard'
import { Images, MonitorSmartphone, CalendarCheck, CreditCard, Map, ClipboardList, Activity, Folder } from 'lucide-react'

export default function Gallery() {
    useProfileRender('Gallery', true);
    const captions = [
        ['Dashboard', 'Unified hospital dashboard showing bed occupancy, revenue snapshot and active appointments.', Activity],
        ['Appointment Scheduler', 'Drag & drop doctor schedules and real-time token view.', CalendarCheck],
        ['OPD Billing Screen', 'Itemized billing with tax and discount calculation.', CreditCard],
        ['IPD Ward Map', 'Bed allocation and patient transfer history.', Map],
        ['Pharmacy Inventory', 'Batch, expiry and stock level management with low-stock alerts.', ClipboardList],
        ['Lab Results Interface', 'Upload and view lab and radiology reports tied to patient record.', Folder],
        ['Surgery Planner', 'OT schedule with consumables and surgeon assignment.', Images],
        ['Patient Portal', 'Patient view for booking, bill payment and report downloads.', MonitorSmartphone],
        ['Mobile View', 'Responsive appointment booking and quick patient lookup on mobile.', MonitorSmartphone],
        ['Integration Flow', 'Diagram of third-party integrations (payments, PACS, insurance).', Images],
    ]

    return (
        <div id="gallery" className="space-y-12">
            <div className="gradient-hero rounded-3xl p-8 border border-slate-200 shadow-sm space-y-5">
                <h1 className="marketing-hero-title text-4xl font-extrabold leading-tight">Product Gallery</h1>
                <p className="text-slate-700 text-base leading-relaxed max-w-3xl">Screens and diagrams showcasing key workflows. Replace placeholders with real screenshots when available.</p>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {captions.map(([title, desc, Icon]) => (
                    <MarketingCard key={title} title={title} desc={desc} icon={Icon} />
                ))}
            </div>
        </div>
    )
}

