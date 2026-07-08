import 'dotenv/config';

async function runBenchmark() {
    const baseUrl = 'http://localhost:4000';
    console.log('Logging in as admin@hms.com...');
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email: 'admin@hms.com',
            password: 'Admin@123'
        })
    });

    if (!loginRes.ok) {
        console.error('Failed to log in:', loginRes.status, await loginRes.text());
        process.exit(1);
    }

    const { token } = await loginRes.json();
    console.log('Login successful. Access token acquired.');

    const endpoints = [
        { name: 'GET /api/doctors', path: '/api/doctors' },
        { name: 'GET /api/patients', path: '/api/patients' },
        { name: 'GET /api/attendance', path: '/api/attendance' },
        { name: 'GET /api/telemedicine/sessions', path: '/api/telemedicine/sessions' },
        { name: 'GET /api/leaves', path: '/api/leaves' },
        { name: 'GET /api/ot/schedules', path: '/api/ot/schedules' }
    ];

    console.log('\nStarting benchmark tests (first run, should cache-miss)...');
    for (const endpoint of endpoints) {
        console.log(`\nTesting ${endpoint.name}...`);
        const start = Date.now();
        const res = await fetch(`${baseUrl}${endpoint.path}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const duration = Date.now() - start;

        if (res.ok) {
            const data = await res.json();
            const total = res.headers.get('x-response-time') || `${duration}ms`;
            const db = res.headers.get('x-db-time') || 'N/A';
            const proc = res.headers.get('x-process-time') || 'N/A';
            const serial = res.headers.get('x-serialization-time') || 'N/A';
            console.log(`Success! Items count: ${Array.isArray(data) ? data.length : (data.items ? data.items.length : 'N/A')}`);
            console.log(`  Metrics (Server-Side Headers):`);
            console.log(`    Total response time  : ${total}`);
            console.log(`    Database query time  : ${db}`);
            console.log(`    Processing time      : ${proc}`);
            console.log(`    Serialization time   : ${serial}`);
        } else {
            console.error(`  Failed with status ${res.status}:`, await res.text());
        }
    }

    console.log('\nStarting benchmark tests (second run, should hit memory cache for tenant/plan/user)...');
    for (const endpoint of endpoints) {
        console.log(`\nTesting ${endpoint.name} (Cached)...`);
        const start = Date.now();
        const res = await fetch(`${baseUrl}${endpoint.path}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const duration = Date.now() - start;

        if (res.ok) {
            const data = await res.json();
            const total = res.headers.get('x-response-time') || `${duration}ms`;
            const db = res.headers.get('x-db-time') || 'N/A';
            const proc = res.headers.get('x-process-time') || 'N/A';
            const serial = res.headers.get('x-serialization-time') || 'N/A';
            console.log(`Success! Items count: ${Array.isArray(data) ? data.length : (data.items ? data.items.length : 'N/A')}`);
            console.log(`  Metrics (Server-Side Headers):`);
            console.log(`    Total response time  : ${total}`);
            console.log(`    Database query time  : ${db}`);
            console.log(`    Processing time      : ${proc}`);
            console.log(`    Serialization time   : ${serial}`);
        } else {
            console.error(`  Failed with status ${res.status}:`, await res.text());
        }
    }
}

runBenchmark().catch(console.error);
