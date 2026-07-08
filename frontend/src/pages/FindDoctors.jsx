import { useProfileRender } from '../utils/profiler';
import { useEffect, useState } from 'react';
import { listPublicDoctors } from '../services/api';
import { Search, Filter, Stethoscope, Mail, Phone, Clock, MapPin, Calendar, ArrowRight, Book } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useSearchParams, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import BookingModal from '../components/BookingModal';
import { toast } from 'react-toastify';

export default function FindDoctors() {
    useProfileRender('FindDoctors', true);
    const [items, setItems] = useState([]);
    const [searchParams] = useSearchParams();
    const [q, setQ] = useState(searchParams.get('q') || '');
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();
    const { user } = useAuth();
    const [bookingDoctorId, setBookingDoctorId] = useState(null);
    const { hospitalSlug } = useParams();

    useEffect(() => {
        setLoading(true);
        listPublicDoctors(hospitalSlug)
            .then(setItems)
            .catch(() => { setItems([]); })
            .finally(() => setLoading(false));
    }, []);

    // Filter logic
    const filtered = items.filter(d => {
        const s = `${d.name} ${d.specialization} ${d.department} ${d.designation}`.toLowerCase();
        return s.includes(q.toLowerCase());
    });

    const categories = ['All', 'Cardiology', 'Dermatology', 'Pediatrics', 'Orthopedics', 'General'];

    const handleBook = (id) => {
        if (!user) {
            toast.info('Please sign in to book an appointment');
            navigate('/login');
            return;
        }
        setBookingDoctorId(id);
    }

    return (
        <div className="min-h-screen bg-slate-50 pt-20 pb-20 px-4 sm:px-6 lg:px-8">
            {/* Header Section */}
            <div className="max-w-7xl mx-auto mb-12 text-center">
                <motion.h1
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-3xl md:text-5xl font-extrabold text-slate-900 tracking-tight"
                >
                    Find Your <span className="text-indigo-600">Specialist</span>
                </motion.h1>
                <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.1 }}
                    className="mt-4 text-lg text-slate-600 max-w-2xl mx-auto"
                >
                    Book appointments with top-rated doctors across all departments.
                </motion.p>

                {/* Search Bar */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="mt-8 max-w-2xl mx-auto"
                >
                    <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                            <Search className="h-5 w-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                        </div>
                        <input
                            type="text"
                            value={q}
                            onChange={e => setQ(e.target.value)}
                            className="block w-full pl-11 pr-4 py-4 bg-white border border-slate-200 rounded-2xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-sm transition-all text-lg"
                            placeholder="Search by name, specialty, or department..."
                        />
                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                            <div className="p-1.5 rounded-lg bg-slate-50 border border-slate-100 hidden sm:block">
                                <span className="text-xs text-slate-400 font-medium px-1">⌘ K</span>
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* Quick Filters */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="mt-6 flex flex-wrap justify-center gap-2"
                >
                    {categories.map((cat) => (
                        <button
                            key={cat}
                            onClick={() => setQ(cat === 'All' ? '' : cat)}
                            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${(cat === 'All' && q === '') || (cat !== 'All' && q.includes(cat))
                                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                                }`}
                        >
                            {cat}
                        </button>
                    ))}
                </motion.div>
            </div>

            {/* Results Grid */}
            <div className="max-w-7xl mx-auto">
                {loading ? (
                    <div className="flex justify-center py-20">
                        <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <AnimatePresence>
                            {filtered.length > 0 ? filtered.map((d) => (
                                <DoctorCard key={d._id || d.id} doctor={d} onBook={() => handleBook(d._id || d.id)} />
                            )) : (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="col-span-full text-center py-20"
                                >
                                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
                                        <Search size={24} />
                                    </div>
                                    <h3 className="text-lg font-semibold text-slate-900">No doctors found</h3>
                                    <p className="text-slate-500">Try adjusting your search terms.</p>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                )}
            </div>

            {/* Booking Modal */}
            {bookingDoctorId && (
                <BookingModal
                    initialDoctorId={bookingDoctorId}
                    onClose={() => setBookingDoctorId(null)}
                    onBooked={() => {
                        setBookingDoctorId(null);
                        navigate('/my-appointments');
                    }}
                />
            )}
        </div>
    );
}

function DoctorCard({ doctor, onBook }) {
    return (
        <motion.div
            layout
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            whileHover={{ y: -5 }}
            className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-xl transition-all overflow-hidden flex flex-col h-full group"
        >
            <div className="p-6 flex-1">
                <div className="flex items-start gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center text-indigo-600 font-bold text-xl shrink-0">
                        {doctor.name.charAt(0)}
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">{doctor.name}</h3>
                        <div className="text-sm font-medium text-emerald-600 mt-0.5">{doctor.specialization}</div>
                        <div className="text-xs text-slate-500 mt-1">{doctor.designation} • {doctor.department}</div>
                    </div>
                </div>

                <div className="mt-6 space-y-3">
                    <div className="flex items-center gap-3 text-sm text-slate-600">
                        <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400">
                            <Book size={16} />
                        </div>
                        <div>
                            <div className="text-xs text-slate-400">Education</div>
                            <div className="font-medium">{doctor.education || doctor.qualifications || 'Medical Graduate'}</div>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-slate-600">
                        <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400">
                            <Clock size={16} />
                        </div>
                        <div>
                            <div className="text-xs text-slate-400">Experience</div>
                            <div className="font-medium">{doctor.experienceYears || 0} Years</div>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-slate-600">
                        <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400">
                            <MapPin size={16} />
                        </div>
                        <div>
                            <div className="text-xs text-slate-400">Consultation Fee</div>
                            <div className="font-medium">₹{Number(doctor.consultationFee || 0).toFixed(0)}</div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-4">
                <button
                    onClick={onBook}
                    className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition shadow-lg shadow-indigo-500/20 active:scale-95 flex items-center justify-center gap-2"
                >
                    <Calendar size={16} /> Book Appointment
                </button>
            </div>
        </motion.div>
    );
}

