import { useProfileRender } from '../utils/profiler';
import { Link } from 'react-router-dom';

export default function Unauthorized() {
    useProfileRender('Unauthorized', true);
    return (
        <div className="min-h-screen bg-gray-100 flex flex-col justify-center items-center">
            <div className="bg-white p-8 rounded-lg shadow-md text-center">
                <h1 className="text-4xl font-bold text-red-500 mb-4">Unauthorized</h1>
                <p className="text-gray-700 mb-6">You do not have permission to view this page.</p>
                <Link to="/" className="text-blue-500 hover:underline">Go to Homepage</Link>
            </div>
        </div>
    );
}

