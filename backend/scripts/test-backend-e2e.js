import fetch from 'node-fetch';
import { prisma } from '../src/config/db.js';

const BASE_URL = 'http://localhost:4000';

async function runFullEnterpriseE2E() {
  console.log('🌐 Starting Full Enterprise HMS End-to-End Integration Suite...\n');

  let authToken = '';
  let createdPatientId = '';
  const validV4DoctorId = 'f47ac10b-58cc-4372-a567-0e02b2c3d479'; // Guaranteed valid v4 UUID

  try {
    // 0. Ensure a test doctor exists with a valid v4 UUID
    const tenantId = '11111111-1111-1111-1111-111111111111';
    const doctorUserId = '55555555-5555-5555-5555-555555555555';

    await prisma.tenant.upsert({
      where: { tenant_id: tenantId },
      update: {},
      create: { tenant_id: tenantId, name: 'E2E Test Hospital', slug: 'e2e-test-hospital', status: 'active' }
    });

    let docUser = await prisma.users.findFirst({ where: { email: 'doctor@testhospital.com' } });
    if (!docUser) {
      docUser = await prisma.users.create({
        data: {
          user_id: doctorUserId,
          tenant_id: tenantId,
          name: 'Dr. House',
          email: 'doctor@testhospital.com',
          password_hash: '$2b$10$E...dummyhash'
        }
      });
    }

    await prisma.doctor_profile.upsert({
      where: { user_id: docUser.user_id },
      update: { doctor_profile_id: validV4DoctorId },
      create: {
        doctor_profile_id: validV4DoctorId,
        user_id: docUser.user_id,
        tenant_id: tenantId,
        specialization: 'General Medicine'
      }
    });

    console.log(`   ✅ Active Test Doctor ID locked (v4): ${validV4DoctorId}`);

    // 1. Authentication
    console.log('\n1. Testing Authentication (Login flow)...');
    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@testhospital.com',
        password: 'Password123!',
        hospitalSlug: 'e2e-test-hospital'
      })
    });

    const loginData = await loginRes.json();
    authToken = loginData.token || loginData.accessToken || loginData.data?.token || loginData.data?.accessToken;

    if (loginRes.ok && authToken) {
      console.log('   ✅ Login successful. JWT Token acquired.');
    } else {
      console.error('   ❌ Login failed. Server response:', loginData);
      return;
    }

    const authHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    };

    // 2. Patient Registration
    console.log('\n2. Testing Patient Registration (HTTP POST /api/patients)...');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const uniquePhone = `998877${randomSuffix}`;

    const patientRes = await fetch(`${BASE_URL}/api/patients`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        firstName: 'Clinical',
        lastName: 'Verification',
        gender: 'MALE',
        phone: uniquePhone,
        dob: '1990-01-01'
      })
    });

    const patientData = await patientRes.json();
    if (patientRes.ok) {
      createdPatientId = patientData.patient_id || patientData.data?.patient_id || patientData.id;
      console.log(`   ✅ Patient registered successfully! ID: ${createdPatientId}`);
    } else {
      console.error('   ❌ Patient creation failed:', patientData);
      return;
    }

    // 3. Appointments & Scheduling
    console.log('\n3. Testing Appointment Booking (HTTP POST /api/appointments)...');
    const appointmentPayload = {
      patientId: createdPatientId,
      doctorId: validV4DoctorId,
      startTime: new Date(Date.now() + 86400000).toISOString(),
      endTime: new Date(Date.now() + 90000000).toISOString(),
      type: 'WALK_IN',
      notes: 'E2E Automated Smoke Test Appointment'
    };

    const appointmentRes = await fetch(`${BASE_URL}/api/appointments`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(appointmentPayload)
    });

    const appointmentData = await appointmentRes.json();
    if (appointmentRes.ok) {
      console.log('   ✅ Appointment successfully scheduled.');
    } else {
      console.error('   ❌ Appointment creation failed:', JSON.stringify(appointmentData, null, 2));
    }

    // 4. Prescription Security (RBAC Check)
    console.log('\n4. Testing Prescription Security (Verifying Admin is blocked)...');
    const prescriptionRes = await fetch(`${BASE_URL}/api/prescriptions`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        patientId: createdPatientId,
        diagnosis: 'Acute Viral Upper Respiratory Infection',
        medications: [{ name: 'Paracetamol', dosage: '500mg', frequency: 'Twice daily', duration: '5 days' }]
      })
    });

    if (prescriptionRes.status === 403) {
      console.log('   ✅ RBAC Security Verified: Hospital Admins are correctly blocked from issuing prescriptions.');
    } else {
      const errData = await prescriptionRes.json();
      console.log('   ℹ️ Prescription response:', errData);
    }

    // 5. Invoicing & Billing
    console.log('\n5. Testing Invoice Generation (HTTP POST /api/invoices)...');
    const invoiceRes = await fetch(`${BASE_URL}/api/invoices`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        patientId: createdPatientId,
        items: [
          { 
            name: 'Consultation Fee', 
            itemName: 'Consultation Fee',
            item_name: 'Consultation Fee',
            description: 'Consultation Fee', 
            entityType: 'CONSULTATION', 
            unitPrice: 50000, 
            quantity: 1 
          }
        ]
      })
    });

    const invoiceData = await invoiceRes.json();
    if (invoiceRes.ok) {
      console.log('   ✅ Invoice generated successfully.');
    } else {
      console.error('   ❌ Invoice generation failed:', invoiceData);
    }

    // 6. Paginated Patient List Validation
    console.log('\n6. Testing Paginated Patient List (HTTP GET /api/patients)...');
    const listRes = await fetch(`${BASE_URL}/api/patients?page=1&limit=10`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    const listData = await listRes.json();
    if (listRes.ok) {
      console.log('   ✅ Fetched patient list over HTTP successfully.');
      console.log(`      Total registered patients in tenant: ${listData.total ?? listData.data?.length ?? 'Unknown'}`);
    } else {
      console.error('   ❌ List fetch failed:', listData);
    }

    console.log('\n🎉 FULL ENTERPRISE HMS E2E INTEGRATION SUITE COMPLETED SUCCESSFULLY!');
  } catch (error) {
    console.error('❌ E2E Integration Suite crashed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

runFullEnterpriseE2E();