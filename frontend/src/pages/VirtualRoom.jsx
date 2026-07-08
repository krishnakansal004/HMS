import { useProfileRender } from '../utils/profiler';
import React from 'react'
import { useAuth } from '../context/AuthContext'
import QueueBoard from './QueueBoard'
import WaitingRoom from './WaitingRoom'

export default function VirtualRoom() {
    useProfileRender('VirtualRoom', true);
    const { user } = useAuth()

    if (!user) return <div className="p-6">Please login to access the Virtual Room.</div>

    // Doctor/admin view: show queue management + room controls
    if (user.role === 'admin' || user.role === 'doctor') {
        return <QueueBoard />
    }

    // Patient view: show waiting room
    if (user.role === 'patient') {
        return <WaitingRoom />
    }

    return <div className="p-6">Unauthorized</div>
}

