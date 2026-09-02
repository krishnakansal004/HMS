import fs from 'fs';
import path from 'path';


// CONFIGURATION (UPDATE THESE)

const CONFIG = {
  BASE_URL: 'http://localhost:5173/api',
  HOSPITAL_SLUG: 'e2e-test-hospital', // Replace with your actual slug
  ADMIN_EMAIL: 'admin@testhospital.com',       // Replace with your admin email
  ADMIN_PASS: 'Password123!',            // Replace with your admin password
};


// MINI TEST RUNNER

let adminToken = null;
let testAppId = null;
let extractedSetupToken = null;
const uniqueEmail = `dr.golden.${Date.now()}@example.com`;

async function test(name, fn) {
  try {
    await fn();
    console.log(`PASS: ${name}`);
  } catch (err) {
    console.error(`FAIL: ${name}`);
    console.error(`   -> ${err.message}`);
    process.exit(1); 
  }
}

async function api(endpoint, options = {}) {
  const headers = { 
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest'
  };
  if (options.token) headers['Authorization'] = `Bearer ${options.token}`;
  
  const res = await fetch(`${CONFIG.BASE_URL}${endpoint}`, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}


// THE TEST SUITES

async function runAllTests() {
  console.log('Starting HMS Identity E2E Test Suite...\n');

  // THE GOLDEN PATH
  await test('1.1 Public Submission (Golden Path)', async () => {
    const res = await api('/doctor-applications', {
      method: 'POST',
      body: {
        hospitalSlug: CONFIG.HOSPITAL_SLUG,
        name: 'Dr. Automated Test',
        email: uniqueEmail,
        specialization: 'Neurology',
        yearsExperience: 5
      }
    });
    if (res.status !== 201) throw new Error(`Expected 201, got ${res.status}: ${res.data?.message}`);
    if (res.data?.data?.status !== 'PENDING') throw new Error('Status is not PENDING');
    testAppId = res.data.data.application_id;
  });

  await test('1.2 Admin Login', async () => {
    const res = await api('/auth/login', {
      method: 'POST',
      body: { email: CONFIG.ADMIN_EMAIL, password: CONFIG.ADMIN_PASS, hospitalSlug: CONFIG.HOSPITAL_SLUG }
    });
    if (res.status !== 200) throw new Error('Admin login failed. Check credentials.');
    adminToken = res.data.data.accessToken;
  });

  await test('1.3 Admin Approval Transaction', async () => {
    const res = await api(`/doctor-applications/${testAppId}/review`, {
      method: 'PATCH',
      token: adminToken,
      body: { status: 'APPROVED' }
    });
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
  });

  await test('1.4 BullMQ Email Extraction (Read Outbox)', async () => {
    console.log('   Waiting 3 seconds for BullMQ to process and fail email...');
    await sleep(3000);
    
    const outboxDir = path.join(process.cwd(), 'uploads', 'email-outbox');
    if (!fs.existsSync(outboxDir)) throw new Error('Outbox directory does not exist.');
    
    const files = fs.readdirSync(outboxDir).filter(f => f.endsWith('.json'));
    if (files.length === 0) throw new Error('No emails found in outbox.');
    
    // Get the most recent email
    files.sort((a, b) => fs.statSync(path.join(outboxDir, b)).mtimeMs - fs.statSync(path.join(outboxDir, a)).mtimeMs);
    const latestFile = files[0];
    const content = fs.readFileSync(path.join(outboxDir, latestFile), 'utf-8');
    
    // Extract token using regex from the setup URL
    const match = content.match(/token=([a-f0-9]{64})/i);
    if (!match) throw new Error('Could not find token in the email HTML.');
    extractedSetupToken = match[1];
  });

  await test('1.5 Setup Password (Crypto Verification)', async () => {
    const res = await api('/auth/setup-password', {
      method: 'POST',
      body: {
        token: extractedSetupToken,
        hospitalSlug: CONFIG.HOSPITAL_SLUG,
        newPassword: 'SecurePassword123!'
      }
    });
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}: ${res.data?.message}`);
  });

  await test('1.6 Final Doctor Login', async () => {
    const res = await api('/auth/login', {
      method: 'POST',
      body: { email: uniqueEmail, password: 'SecurePassword123!', hospitalSlug: CONFIG.HOSPITAL_SLUG }
    });
    if (res.status !== 200) throw new Error(`New doctor login failed: ${res.data?.message}`);
    if (res.data?.data?.user?.role !== 'DOCTOR') throw new Error('Role is not DOCTOR');
  });


  // --- SUITE 2: EDGE CASES & SECURITY ---
  console.log('\n Testing Security & Edge Cases...');

  await test('2.1 Duplicate Pending Guard', async () => {
    const payload = {
      hospitalSlug: CONFIG.HOSPITAL_SLUG,
      name: 'Dr. Spam', email: `spam.${Date.now()}@test.com`, specialization: 'Cardiology'
    };
    await api('/doctor-applications', { method: 'POST', body: payload }); // First works
    const res = await api('/doctor-applications', { method: 'POST', body: payload }); // Second fails
    if (res.status !== 409) throw new Error(`Expected 409 Conflict, got ${res.status}`);
  });

  await test('2.2 Invalid Hospital Slug Guard', async () => {
    const res = await api('/doctor-applications', {
      method: 'POST',
      body: { hospitalSlug: 'fake-hospital-999', name: 'Dr. Fake', email: 'fake@test.com', specialization: 'Cardiology' }
    });
    if (res.status !== 404) throw new Error(`Expected 404 Not Found, got ${res.status}`);
  });

  await test('2.3 Unauthorized Review Attempt', async () => {
    // Attempt to approve an app without the admin token
    const res = await api(`/doctor-applications/${testAppId}/review`, {
      method: 'PATCH',
      body: { status: 'REJECTED' }
    });
    if (res.status !== 401 && res.status !== 403) throw new Error(`Expected 401/403, got ${res.status}`);
  });

  await test('2.4 Tampered Setup Token Rejection', async () => {
    const res = await api('/auth/setup-password', {
      method: 'POST',
      body: {
        token: 'invalid' + extractedSetupToken.substring(7),
        hospitalSlug: CONFIG.HOSPITAL_SLUG,
        newPassword: 'SecurePassword123!'
      }
    });
    if (res.status !== 400) throw new Error(`Expected 400 Bad Request, got ${res.status}`);
  });

  await test('2.5 Weak Password Rejection', async () => {
    const res = await api('/auth/setup-password', {
      method: 'POST',
      body: {
        token: extractedSetupToken, // Real token, but already used
        hospitalSlug: CONFIG.HOSPITAL_SLUG,
        newPassword: 'weak'
      }
    });
    if (res.status !== 400) throw new Error(`Expected 400 Bad Request, got ${res.status}`);
    const hasPasswordError = res.data?.errors?.some(e => e.field === 'newPassword');
    if (!hasPasswordError) throw new Error('Validator did not catch weak password');
  });

  await test('2.6 Tenant Enumeration Protection', async () => {
    const res = await api('/auth/login', {
      method: 'POST',
      body: { email: 'nobody@nowhere.com', password: 'wrong', hospitalSlug: 'nonexistent-slug' }
    });
    if (res.status !== 401 && res.status !== 429) {
      throw new Error(`Expected 401 or 429 generic error, got ${res.status}`);
    }
  });

  console.log('\n🎉 ALL TESTS PASSED! The Identity Lifecycle is ironclad.');
}

runAllTests();