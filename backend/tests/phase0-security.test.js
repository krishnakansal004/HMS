import crypto from 'node:crypto';
import { jest, describe, beforeEach, expect, it } from '@jest/globals';

const documents = {
  findByIdAndTenant: jest.fn(),
};
const audit = { logAction: jest.fn() };
const signUrl = jest.fn();

jest.unstable_mockModule('../src/repositories/documentRepository.js', () => ({ DocumentRepository: documents }));
jest.unstable_mockModule('../src/services/auditService.js', () => ({ AuditService: audit }));
jest.unstable_mockModule('../src/config/cloudinary.js', () => ({ createSignedCloudinaryUrl: signUrl }));

const { DocumentService } = await import('../src/services/documentService.js');

describe('Phase 0 object and tenant authorization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    documents.findByIdAndTenant.mockImplementation(async (_id, tenantId) => tenantId === 'tenant-a'
      ? {
        document_id: '11111111-1111-4111-8111-111111111111',
        tenant_id: 'tenant-a',
        public_id: 'hms/tenant-a/file-a',
        mime_type: 'audio/webm',
        entity_type: 'PATIENT',
        entity_id: '22222222-2222-4222-8222-222222222222',
        size_bytes: 100,
        created_at: new Date('2026-01-01T00:00:00.000Z'),
      }
      : null);
    signUrl.mockReturnValue('https://res.cloudinary.test/signed-file');
  });

  it('creates a signed media URL only after tenant/object authorization', async () => {
    const result = await DocumentService.getDownloadUrl({
      tenantId: 'tenant-a',
      userId: 'doctor-a',
      userRole: 'DOCTOR',
      documentId: '11111111-1111-4111-8111-111111111111',
    });

    expect(result.downloadUrl).toBe('https://res.cloudinary.test/signed-file');
    expect(signUrl).toHaveBeenCalledWith('hms/tenant-a/file-a', 'audio/webm');
    expect(documents.findByIdAndTenant).toHaveBeenCalledWith(
      '11111111-1111-4111-8111-111111111111',
      'tenant-a',
    );
  });

  it('does not disclose another tenant document', async () => {
    await expect(DocumentService.getDownloadUrl({
      tenantId: 'tenant-b',
      userId: 'doctor-b',
      userRole: 'DOCTOR',
      documentId: '11111111-1111-4111-8111-111111111111',
    })).rejects.toMatchObject({ statusCode: 404 });
    expect(signUrl).not.toHaveBeenCalled();
  });
});

const invoice = {
  invoice_id: '33333333-3333-4333-8333-333333333333',
  tenant_id: 'tenant-a',
  razorpay_order_id: 'order_a',
  total: 10000,
  amount_paid: 0,
  status: 'pending',
  deleted_at: null,
};
const invoiceModel = { findFirst: jest.fn() };
const settingModel = { findFirst: jest.fn() };
const transaction = {
  $queryRaw: jest.fn().mockResolvedValue([invoice]),
  payment: { findFirst: jest.fn(), create: jest.fn() },
  invoice: { update: jest.fn() },
};
const db = {
  invoice: invoiceModel,
  setting: settingModel,
  $transaction: jest.fn((callback) => callback(transaction)),
};

jest.unstable_mockModule('../src/config/db.js', () => ({
  db,
  tenantStorage: { run: (_context, callback) => callback() },
}));
jest.unstable_mockModule('../src/config/env.js', () => ({
  env: { razorpay: { keyId: 'key', keySecret: 'secret', webhookSecret: 'webhook' }, nodeEnv: 'test' },
}));
const fetchPayment = jest.fn();
class RazorpayMock {
  constructor() {
    this.payments = { fetch: fetchPayment };
  }
}
jest.unstable_mockModule('razorpay', () => ({ default: RazorpayMock }));

const { PaymentService } = await import('../src/services/paymentService.js');

describe('Phase 0 server-authoritative payment verification', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    invoiceModel.findFirst.mockResolvedValue(invoice);
    settingModel.findFirst.mockResolvedValue({ value: 'INR' });
    transaction.payment.findFirst.mockResolvedValue(null);
    transaction.payment.create.mockResolvedValue({ transaction_id: 'pay_a', amount: 10000 });
    fetchPayment.mockResolvedValue({
      id: 'pay_a', order_id: 'order_a', amount: 10000, currency: 'INR', status: 'captured',
    });
  });

  it('uses Razorpay captured amount instead of the browser amount', async () => {
    const signature = crypto.createHmac('sha256', 'secret').update('order_a|pay_a').digest('hex');
    await PaymentService.verifyPaymentWebhook({
      tenantId: 'tenant-a',
      invoiceId: invoice.invoice_id,
      gatewayPaymentId: 'pay_a',
      razorpayOrderId: 'order_a',
      amountPaid: 1,
      signature,
    });

    expect(fetchPayment).toHaveBeenCalledWith('pay_a');
    expect(transaction.payment.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ amount: 10000 }),
    }));
  });

  it('rejects a payment that Razorpay has not captured', async () => {
    fetchPayment.mockResolvedValue({
      id: 'pay_a', order_id: 'order_a', amount: 10000, currency: 'INR', status: 'failed',
    });
    const signature = crypto.createHmac('sha256', 'secret').update('order_a|pay_a').digest('hex');
    await expect(PaymentService.verifyPaymentWebhook({
      tenantId: 'tenant-a',
      invoiceId: invoice.invoice_id,
      gatewayPaymentId: 'pay_a',
      razorpayOrderId: 'order_a',
      amountPaid: 10000,
      signature,
    })).rejects.toMatchObject({ statusCode: 400 });
    expect(transaction.payment.create).not.toHaveBeenCalled();
  });
});
