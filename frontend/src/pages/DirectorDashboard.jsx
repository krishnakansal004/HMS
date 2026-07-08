import { useProfileRender } from '../utils/profiler';
import React from 'react'

export default function DirectorDashboard() {
    useProfileRender('DirectorDashboard', true);
    return (
        <div>
            <h2 className="text-2xl font-semibold mb-4">Director Dashboard</h2>
            <p>Welcome to the Director panel. Use the sidebar to navigate.</p>
        </div>
    )
}

