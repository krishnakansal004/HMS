import { useProfileRender } from '../utils/profiler';
import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import { Video, VideoOff, Mic, MicOff, PhoneOff, Monitor, Edit, MessageSquare, ClipboardList, PenTool } from 'lucide-react';

export default function Telemedicine() {
    useProfileRender('Telemedicine', true);
    const { user } = useAuth();
    const [activeSession, setActiveSession] = useState(null);
    const [showCallRoom, setShowCallRoom] = useState(false);

    const { data: rawSessions, refetch: fetchSessions } = useQuery({
        queryKey: ['telemedicineSessions'],
        queryFn: async () => {
            const res = await fetch('/api/telemedicine/sessions', {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('hms.auth.token')}` }
            })
            if (!res.ok) throw new Error('Failed to load telemedicine schedule')
            return res.json()
        },
        enabled: !!user,
    })

    const sessions = useMemo(() => rawSessions || [], [rawSessions])

    // Call States
    const [micOn, setMicOn] = useState(true);
    const [videoOn, setVideoOn] = useState(true);
    const [screenShareOn, setScreenShareOn] = useState(false);
    const [activeSidebar, setActiveSidebar] = useState('notes'); // notes | chat | whiteboard
    const [chatMessages, setChatMessages] = useState([]);
    const [messageInput, setMessageInput] = useState('');
    const [doctorNotes, setDoctorNotes] = useState('');

    const completeSessionMutation = useMutation({
        mutationFn: async ({ sessionId, doctorNotes }) => {
            const res = await fetch(`/api/telemedicine/sessions/${sessionId}/complete`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('hms.auth.token')}`
                },
                body: JSON.stringify({ doctorNotes, callDurationSeconds: 450 })
            })
            if (!res.ok) throw new Error('Completion update failed')
            return res.json()
        },
        onSuccess: () => {
            toast.success('Consultation session successfully completed.')
            setShowCallRoom(false)
            setActiveSession(null)
            fetchSessions()
        },
        onError: (err) => {
            toast.error(err.message || 'Completion update failed')
        }
    })

    const joinCallRoom = (session) => {
        setActiveSession(session);
        setMicOn(true);
        setVideoOn(true);
        setScreenShareOn(false);
        setChatMessages([
            { sender: 'System', text: 'Secured WebRTC signaling channel opened.', time: new Date() },
            { sender: 'System', text: `Patient ${session.patientName} has connected.`, time: new Date() }
        ]);
        setDoctorNotes(session.doctorNotes || '');
        setShowCallRoom(true);
    };

    const handleSendMessage = (e) => {
        e.preventDefault();
        if (!messageInput.trim()) return;
        setChatMessages(prev => [...prev, {
            sender: user?.name || 'Doctor',
            text: messageInput,
            time: new Date()
        }]);
        setMessageInput('');
        
        // Mock patient replies automatically
        setTimeout(() => {
            setChatMessages(prev => [...prev, {
                sender: activeSession.patientName,
                text: 'Yes doctor, I can hear you clearly. Let me show you the report.',
                time: new Date()
            }]);
        }, 1200);
    };

    const handleEndCall = () => {
        if (!activeSession) return
        completeSessionMutation.mutate({
            sessionId: activeSession._id,
            doctorNotes
        })
    };

    return (
        <div className="p-6 space-y-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/60 backdrop-blur-md p-6 rounded-2xl border border-slate-100 shadow-sm">
                <div>
                    <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight flex items-center gap-3">
                        <Video className="text-indigo-600 animate-pulse" size={32} />
                        Telemedicine & Video Consultation
                    </h1>
                    <p className="text-slate-500 font-medium mt-1">Initiate virtual consult rooms, log call notes, and prescribe medicines live during the session.</p>
                </div>
            </div>

            {/* Session Schedule Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {sessions.length === 0 ? (
                    <div className="col-span-full bg-white p-8 rounded-2xl border text-center text-slate-400">
                        No scheduled video consultations found.
                    </div>
                ) : (
                    sessions.map(s => (
                        <div key={s._id} className="bg-white p-5 rounded-2xl border border-slate-100 hover:border-indigo-100 shadow-sm space-y-4 transition-all flex flex-col justify-between">
                            <div>
                                <div className="flex justify-between items-start">
                                    <span className="text-xs bg-indigo-50 text-indigo-700 font-extrabold px-2.5 py-0.5 rounded-md uppercase">Room: {s.roomId}</span>
                                    <span className={`text-xs font-bold px-2 py-0.5 rounded uppercase ${s.status === 'completed' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700 animate-pulse'}`}>
                                        {s.status}
                                    </span>
                                </div>
                                <h3 className="font-extrabold text-slate-800 text-lg mt-3">Virtual Consult</h3>
                                <p className="text-slate-600 font-semibold text-sm">Patient: {s.patientName}</p>
                                <p className="text-slate-400 text-xs mt-0.5">Doctor: {s.doctorName}</p>
                            </div>
                            
                            <div className="pt-4 border-t flex gap-2">
                                {s.status !== 'completed' ? (
                                    <button
                                        onClick={() => joinCallRoom(s)}
                                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-2 px-3 rounded-lg w-full flex items-center justify-center gap-1 cursor-pointer transition-all hover:scale-[1.02]"
                                    >
                                        <Video size={14} /> Join Clinic Room
                                    </button>
                                ) : (
                                    <div className="bg-slate-50 text-slate-400 text-xs text-center font-bold py-2 rounded-lg w-full">
                                        Session Concluded
                                    </div>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* WebRTC Video Call Room Simulator Overlay */}
            {showCallRoom && activeSession && (
                <div className="fixed inset-0 bg-slate-950/98 z-50 overflow-y-auto flex flex-col">
                    {/* Top Call Banner */}
                    <div className="bg-slate-900 border-b border-slate-800 p-4 flex justify-between items-center text-slate-200">
                        <div>
                            <h3 className="font-extrabold text-white text-md flex items-center gap-2">
                                <Video className="text-rose-500 animate-pulse" size={18} />
                                Ayushman Tele-Consult Room
                            </h3>
                            <p className="text-slate-400 text-xs mt-0.5">Secure WebRTC Signaling | Room ID: {activeSession.roomId}</p>
                        </div>
                        <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-mono px-3 py-1 rounded-full">
                            ENCRYPTED CALL
                        </span>
                    </div>

                    {/* Workstation layout */}
                    <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 bg-slate-950">
                        {/* Video feeds viewport (left 3 columns) */}
                        <div className="lg:col-span-3 p-6 flex flex-col items-center justify-center space-y-6">
                            {/* Video grid boxes */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl">
                                {/* Doctor Feed */}
                                <div className="relative border border-slate-800 rounded-2xl bg-slate-900 aspect-video overflow-hidden shadow-2xl flex items-center justify-center">
                                    {videoOn ? (
                                        <div className="absolute inset-0 bg-gradient-to-tr from-slate-950 to-slate-900/40 flex items-center justify-center">
                                            {/* Simulated video graphics */}
                                            <div className="w-16 h-16 rounded-full bg-indigo-600/30 border border-indigo-500 flex items-center justify-center text-white font-extrabold text-xl animate-pulse">
                                                DR
                                            </div>
                                            <span className="absolute bottom-4 left-4 font-mono text-xs text-indigo-300 bg-black/40 px-2 py-0.5 rounded">Dr. {activeSession.doctorName} (You)</span>
                                        </div>
                                    ) : (
                                        <div className="text-slate-500 text-sm font-bold flex flex-col items-center gap-2">
                                            <VideoOff size={24} /> Video Stopped
                                        </div>
                                    )}
                                </div>

                                {/* Patient Feed */}
                                <div className="relative border border-slate-800 rounded-2xl bg-slate-900 aspect-video overflow-hidden shadow-2xl flex items-center justify-center">
                                    <div className="absolute inset-0 bg-gradient-to-tr from-slate-950 to-slate-800/20 flex items-center justify-center">
                                        <div className="w-16 h-16 rounded-full bg-rose-600/20 border border-rose-500 flex items-center justify-center text-white font-extrabold text-xl animate-pulse">
                                            PT
                                        </div>
                                        <span className="absolute bottom-4 left-4 font-mono text-xs text-rose-300 bg-black/40 px-2 py-0.5 rounded">Patient: {activeSession.patientName}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Call toolbar */}
                            <div className="flex gap-4 bg-slate-900/80 p-3 rounded-2xl border border-slate-800 shadow-lg text-slate-200">
                                <button
                                    onClick={() => setMicOn(!micOn)}
                                    className={`p-3 rounded-xl transition-all cursor-pointer ${micOn ? 'bg-slate-800 hover:bg-slate-700' : 'bg-rose-600 text-white'}`}
                                >
                                    {micOn ? <Mic size={20} /> : <MicOff size={20} />}
                                </button>
                                <button
                                    onClick={() => setVideoOn(!videoOn)}
                                    className={`p-3 rounded-xl transition-all cursor-pointer ${videoOn ? 'bg-slate-800 hover:bg-slate-700' : 'bg-rose-600 text-white'}`}
                                >
                                    {videoOn ? <Video size={20} /> : <VideoOff size={20} />}
                                </button>
                                <button
                                    onClick={() => setScreenShareOn(!screenShareOn)}
                                    className={`p-3 rounded-xl transition-all cursor-pointer ${screenShareOn ? 'bg-indigo-600 text-white' : 'bg-slate-800 hover:bg-slate-700'}`}
                                >
                                    <Monitor size={20} />
                                </button>
                                <button
                                    onClick={handleEndCall}
                                    className="p-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl transition-all cursor-pointer"
                                    title="End Consultation"
                                >
                                    <PhoneOff size={20} />
                                </button>
                            </div>
                        </div>

                        {/* Call clinical notes and chat sidebar (right 1 column) */}
                        <div className="bg-slate-900 border-l border-slate-800 flex flex-col justify-between text-slate-200">
                            {/* Tabs */}
                            <div className="grid grid-cols-3 border-b border-slate-800 text-center text-xs font-bold text-slate-400">
                                <button
                                    onClick={() => setActiveSidebar('notes')}
                                    className={`py-3 flex items-center justify-center gap-1 cursor-pointer ${activeSidebar === 'notes' ? 'border-b-2 border-indigo-500 text-white bg-slate-950/20' : ''}`}
                                >
                                    <ClipboardList size={14} /> Notes
                                </button>
                                <button
                                    onClick={() => setActiveSidebar('chat')}
                                    className={`py-3 flex items-center justify-center gap-1 cursor-pointer ${activeSidebar === 'chat' ? 'border-b-2 border-indigo-500 text-white bg-slate-950/20' : ''}`}
                                >
                                    <MessageSquare size={14} /> Chat
                                </button>
                                <button
                                    onClick={() => setActiveSidebar('whiteboard')}
                                    className={`py-3 flex items-center justify-center gap-1 cursor-pointer ${activeSidebar === 'whiteboard' ? 'border-b-2 border-indigo-500 text-white bg-slate-950/20' : ''}`}
                                >
                                    <PenTool size={14} /> Board
                                </button>
                            </div>

                            {/* Panel views */}
                            <div className="flex-1 p-4 overflow-y-auto">
                                {activeSidebar === 'notes' && (
                                    <div className="space-y-4">
                                        <h4 className="text-white font-extrabold text-sm uppercase">Clinical consultation log</h4>
                                        <div className="space-y-1">
                                            <label className="text-[10px] text-slate-400 font-bold block">Diagnosis & Prescriptions</label>
                                            <textarea
                                                value={doctorNotes}
                                                onChange={e => setDoctorNotes(e.target.value)}
                                                rows="12"
                                                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-sans leading-relaxed"
                                                placeholder="Type clinical consultation summary and prescriptions..."
                                            />
                                        </div>
                                    </div>
                                )}

                                {activeSidebar === 'chat' && (
                                    <div className="flex flex-col h-full justify-between">
                                        <div className="space-y-3 flex-1 overflow-y-auto max-h-[50vh] pr-1">
                                            {chatMessages.map((msg, idx) => (
                                                <div key={idx} className={`p-2 rounded-lg text-xs leading-relaxed max-w-[85%] ${msg.sender === 'System' ? 'bg-slate-950 border border-slate-800 text-slate-500 text-center font-mono w-full max-w-full' : msg.sender === user?.name ? 'bg-indigo-600 text-white ml-auto' : 'bg-slate-800 text-slate-300'}`}>
                                                    <span className="text-[10px] font-bold block opacity-75">{msg.sender}</span>
                                                    <p>{msg.text}</p>
                                                </div>
                                            ))}
                                        </div>
                                        <form onSubmit={handleSendMessage} className="flex gap-1.5 mt-3 pt-3 border-t border-slate-800">
                                            <input
                                                type="text"
                                                value={messageInput}
                                                onChange={e => setMessageInput(e.target.value)}
                                                placeholder="Message patient..."
                                                className="bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs w-full text-white focus:outline-none"
                                            />
                                            <button type="submit" className="bg-indigo-600 text-white px-3 py-2 rounded-lg text-xs font-bold cursor-pointer">Send</button>
                                        </form>
                                    </div>
                                )}

                                {activeSidebar === 'whiteboard' && (
                                    <div className="space-y-3 flex flex-col items-center justify-center h-full">
                                        <div className="border border-slate-800 rounded-xl bg-slate-950 w-full aspect-square flex items-center justify-center relative overflow-hidden">
                                            <PenTool size={32} className="text-slate-700 animate-bounce" />
                                            <span className="text-xs text-slate-500 font-mono">Interactive whiteboard room</span>
                                        </div>
                                        <p className="text-slate-500 text-[10px] text-center">Draw diagrams or markup anatomical models for patients.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

