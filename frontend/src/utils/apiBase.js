// Utility to get API base URL consistently across all components
export function getApiBase() {
  return (typeof import.meta !== 'undefined' && import.meta.env && typeof import.meta.env.VITE_API_URL !== 'undefined')
    ? (import.meta.env.VITE_API_URL || '')
    : ''
}

