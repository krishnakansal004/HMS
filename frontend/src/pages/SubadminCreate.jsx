import { useProfileRender } from '../utils/profiler';
import React from 'react'
import { Navigate } from 'react-router-dom'

// This page was removed per request — keep a redirect so any lingering links don't 404.
export default function SubadminCreate() {
    useProfileRender('SubadminCreate', true);
    return <Navigate to="/" replace />
}

