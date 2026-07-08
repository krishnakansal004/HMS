import React from 'react';
import { ShieldAlert, RefreshCw, Home } from 'lucide-react';
import { useRouteError } from 'react-router-dom';

export default class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error('[ErrorBoundary] Uncaught application error:', error, errorInfo);
    }

    handleReset = () => {
        this.setState({ hasError: false, error: null });
        window.location.reload();
    };

    handleGoHome = () => {
        this.setState({ hasError: false, error: null });
        window.location.href = '/';
    };

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 font-sans">
                    <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-100 p-8 text-center">
                        <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                            <ShieldAlert size={32} />
                        </div>
                        <h1 className="text-2xl font-bold text-slate-800 mb-2">Something went wrong</h1>
                        <p className="text-slate-500 mb-6 text-sm">
                            An unexpected error occurred. The application was stopped to prevent data corruption.
                        </p>
                        {this.state.error?.message && (
                            <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 mb-6 text-left max-h-32 overflow-y-auto">
                                <span className="text-xs font-mono text-slate-500 font-semibold block uppercase mb-1">Error Details</span>
                                <code className="text-xs font-mono text-red-600 break-words">
                                    {this.state.error.message}
                                </code>
                            </div>
                        )}
                        <div className="flex flex-col sm:flex-row gap-3">
                            <button
                                onClick={this.handleReset}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-lg shadow-blue-200 transition-all text-sm"
                            >
                                <RefreshCw size={16} /> Reload Page
                            </button>
                            <button
                                onClick={this.handleGoHome}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition-all text-sm"
                            >
                                <Home size={16} /> Go to Home
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export function RouteErrorBoundary() {
    const error = useRouteError();
    console.error('[RouteErrorBoundary] Uncaught route error:', error);
    
    const handleReset = () => {
        window.location.reload();
    };

    const handleGoHome = () => {
        window.location.href = '/';
    };

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 font-sans">
            <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-100 p-8 text-center">
                <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                    <ShieldAlert size={32} />
                </div>
                <h1 className="text-2xl font-bold text-slate-800 mb-2">Something went wrong</h1>
                <p className="text-slate-500 mb-6 text-sm">
                    An unexpected error occurred. The application was stopped to prevent data corruption.
                </p>
                {error?.message && (
                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 mb-6 text-left max-h-32 overflow-y-auto">
                        <span className="text-xs font-mono text-slate-500 font-semibold block uppercase mb-1">Error Details</span>
                        <code className="text-xs font-mono text-red-600 break-words">
                            {error.message}
                        </code>
                    </div>
                )}
                <div className="flex flex-col sm:flex-row gap-3">
                    <button
                        onClick={handleReset}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-lg shadow-blue-200 transition-all text-sm"
                    >
                        <RefreshCw size={16} /> Reload Page
                    </button>
                    <button
                        onClick={handleGoHome}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition-all text-sm"
                    >
                        <Home size={16} /> Go to Home
                    </button>
                </div>
            </div>
        </div>
    );
}
