import { useEffect } from 'react';

// Global registry for telemetry
if (typeof window !== 'undefined') {
    window.__renderTelemetry = window.__renderTelemetry || {
        renders: {},
        mounts: {},
        effects: {},
        apiRequests: 0,
        pageApiRequests: {}
    };

    // Global Fetch Interceptor
    if (!window.__fetchIntercepted) {
        window.__fetchIntercepted = true;
        const originalFetch = window.fetch;
        window.fetch = async function(...args) {
            window.__renderTelemetry.apiRequests++;
            const activePage = window.__activePage || 'unknown';
            window.__renderTelemetry.pageApiRequests[activePage] = (window.__renderTelemetry.pageApiRequests[activePage] || 0) + 1;
            console.log(`[PROFILE-API] [Page: ${activePage}] API Request: ${args[0]}`);
            return originalFetch.apply(this, args);
        };
    }
}

export function useProfileRender(componentName, isPage = false) {
    if (typeof window === 'undefined') return;
    
    if (isPage) {
        window.__activePage = componentName;
    }

    // Initialize counts
    if (!window.__renderTelemetry.renders[componentName]) {
        window.__renderTelemetry.renders[componentName] = 0;
        window.__renderTelemetry.mounts[componentName] = 0;
        window.__renderTelemetry.effects[componentName] = 0;
    }

    window.__renderTelemetry.renders[componentName]++;
    console.log(`[PROFILE-RENDER] ${componentName} render #${window.__renderTelemetry.renders[componentName]}`);

    // Mount / Unmount
    useEffect(() => {
        window.__renderTelemetry.mounts[componentName]++;
        console.log(`[PROFILE-MOUNT] ${componentName} mounted (total: ${window.__renderTelemetry.mounts[componentName]})`);
        return () => {
            console.log(`[PROFILE-UNMOUNT] ${componentName} unmounted`);
        };
    }, []);

    // Effect triggers
    useEffect(() => {
        window.__renderTelemetry.effects[componentName]++;
        console.log(`[PROFILE-EFFECT] ${componentName} effect executed (total: ${window.__renderTelemetry.effects[componentName]})`);
    });
}
