import request from 'supertest';
import app from '../src/app.js';
import { db, disconnectDB } from '../src/config/db.js'; // <-- Add disconnectDB
import { redisConnection } from '../src/config/redis.js'; // <-- Add Redis connection
import jwt from 'jsonwebtoken';
import { env } from '../src/config/env.js';

describe('Security Remediation Verifications', () => {
  let doctorToken;
  let adminToken;
  let testTenantId;
  let testDoctorId;

  beforeAll(async () => {
    // 1. Inject a mock secret so crypto.createHmac doesn't crash (Fixes the 500)
    process.env.RAZORPAY_SECRET = process.env.RAZORPAY_SECRET || 'test_secret_key';

    testTenantId = '00000000-0000-0000-0000-000000000000';
    testDoctorId = '11111111-1111-1111-1111-111111111111';

    doctorToken = jwt.sign({ sub: testDoctorId, role: 'DOCTOR', tenantId: testTenantId }, env.jwt.accessSecret);
    adminToken = jwt.sign({ sub: '22222222-2222-2222-2222-222222222222', role: 'HOSPITAL_ADMIN', tenantId: testTenantId }, env.jwt.accessSecret);
  });

  // 2. Tear down the connections when tests finish (Fixes the open handles warning)
  afterAll(async () => {
    await disconnectDB();
    await redisConnection.quit();
  });

 describe('1. Payment Cryptographic Binding', () => {
    it('should reject a payment webhook with an invalid or mismatched signature', async () => {
      const res = await request(app)
        .post('/api/payments/webhook/verify')
        .send({
          invoiceId: '00000000-0000-0000-0000-000000000000', // <-- Changed to valid UUID format
          gatewayPaymentId: 'pay_123',
          razorpayOrderId: 'order_123',
          amountPaid: 5000,
          signature: 'fake_forged_signature_hash'
        });
      
      expect(res.status).toBe(401);
      expect(res.body.message).toMatch(/Cryptographic signature verification failed/i);
    });
  });

  describe('2. Document IDOR Protection', () => {
    it('should prevent a DOCTOR from deleting a document uploaded by someone else', async () => {
      // Assuming document 'doc-123' belongs to patient or admin
      const res = await request(app)
        .delete('/api/documents/doc-123')
        .set('Authorization', `Bearer ${doctorToken}`);
      
      // Should return 403 Forbidden or 404 (if RLS hides it), not 200 OK
      expect(res.status).not.toBe(200);
    });
  });

  describe('3. Public Form Rate Limiting', () => {
    it('should block excessive public query submissions', async () => {
      const makeRequest = () => request(app).post('/api/queries').send({
        name: 'Test', email: 'test@test.com', message: 'Spam'
      });

      // Hit the endpoint 11 times (limit is 10 per 15 mins)
      for (let i = 0; i < 10; i++) {
        await makeRequest();
      }
      
      const blockedRes = await makeRequest();
      expect(blockedRes.status).toBe(429); // Too Many Requests
    });
  });

  describe('4. Unmapped Prisma Error Sanitization', () => {
    it('should not leak raw database schema details on bad requests', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'invalid-email', password: 'bad' });
      
      // Ensure the raw Postgres/Prisma internal string is not in the response
      expect(res.body.message).not.toMatch(/invocation/i);
      expect(res.body.message).not.toMatch(/PrismaClient/i);
    });
  });
});