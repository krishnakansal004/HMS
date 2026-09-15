import express from 'express';
import { jest, describe, expect, it } from '@jest/globals';

const controller = {
  register: jest.fn(),
  listForEntity: jest.fn(),
  download: jest.fn((req, res) => res.status(200).json({ success: true, tenantId: req.currentTenantId, id: req.params.id })),
  remove: jest.fn(),
};

jest.unstable_mockModule('../src/controllers/documentController.js', () => ({ DocumentController: controller }));
jest.unstable_mockModule('../src/middlewares/authMiddleware.js', () => ({
  protect: (req, res, next) => {
    req.userId = 'user-a';
    req.userRole = 'DOCTOR';
    next();
  },
  requireRoles: () => (req, res, next) => next(),
}));
jest.unstable_mockModule('../src/middlewares/tenantMiddleware.js', () => ({
  requireTenant: (req, res, next) => {
    req.currentTenantId = 'tenant-a';
    next();
  },
}));

const { default: documentsRouter } = await import('../src/routes/documents.js');

describe('Phase 0 authenticated document delivery route', () => {
  it('passes the authenticated tenant context to the JIT download handler', async () => {
    const app = express();
    app.use('/api/documents', documentsRouter);
    const route = documentsRouter.stack.find((layer) => layer.route?.path === '/:id/download');
    expect(route).toBeDefined();
    expect(route.route.methods.get).toBe(true);

    const handler = route.route.stack.at(-1).handle;
    const req = {
      params: { id: '11111111-1111-4111-8111-111111111111' },
      currentTenantId: 'tenant-a',
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    await handler(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      tenantId: 'tenant-a',
      id: '11111111-1111-4111-8111-111111111111',
    });
  });
});
