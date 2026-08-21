import { TenantPlanRepository } from '../repositories/tenantPlanRepository.js';
import { AuditService } from './auditService.js';
import { AppError } from '../middlewares/errorHandler.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';
import { db } from '../config/db.js';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

export class TenantPlanService {
  
  static async createPlan({ userId, name, publicFlag, customized, accessCode, durations, prices, limits, ipAddress }) {
    const plan = await TenantPlanRepository.createPlan({
      name,
      public: publicFlag || false,
      customized: customized || false,
      access_code: accessCode || null,
      durations: durations ? JSON.parse(JSON.stringify(durations)) : undefined,
      prices: prices ? JSON.parse(JSON.stringify(prices)) : undefined,
      limits: limits ? JSON.parse(JSON.stringify(limits)) : undefined,
      status: 'active'
    });

    AuditService.logAction({
      tenantId: null, // Global action
      userId,
      action: 'CREATE_SUBSCRIPTION_PLAN',
      entityType: 'PLAN',
      entityId: plan.plan_id,
      newValue: { name, limits },
      ipAddress
    });

    return plan;
  }

  static async listPlans() {
    return TenantPlanRepository.findActivePlans();
  }

  static async provisionHospitalTenant({ name, slug, planId, adminName, adminEmail, adminPassword, ipAddress }) {
    // Verify Plan exists
    const plan = await TenantPlanRepository.findPlanById(planId);
    if (!plan || plan.status !== 'active') {
      throw new AppError('Selected subscription plan is invalid or inactive.', HTTP_STATUS.BAD_REQUEST);
    }

    // Check if slug is taken
    const existingTenant = await TenantPlanRepository.findTenantBySlug(slug);
    if (existingTenant) {
      throw new AppError('Hospital portal slug is already taken. Choose another.', HTTP_STATUS.CONFLICT);
    }

    // Resolve Hospital Admin role ID
    const adminRole = await db.role.findUnique({ where: { name: 'HOSPITAL_ADMIN' } });
    if (!adminRole) {
      throw new AppError('System configuration error: HOSPITAL_ADMIN role missing.', HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }

    // Hash password
    const passwordHash = await bcrypt.hash(adminPassword, 12);

    // Execute Provisioning Transaction
    const { tenant, adminUser } = await TenantPlanRepository.createTenantTransaction(
      {
        name,
        slug: slug.toLowerCase().trim(),
        plan_id: planId,
        status: 'active'
      },
      {
        name: adminName,
        email: adminEmail.toLowerCase().trim(),
        passwordHash
      },
      adminRole.role_id
    );

    AuditService.logAction({
      tenantId: tenant.tenant_id,
      userId: adminUser.user_id,
      action: 'PROVISION_HOSPITAL_TENANT',
      entityType: 'TENANT',
      entityId: tenant.tenant_id,
      newValue: { name, slug, planId },
      ipAddress
    });

    return { tenant, adminUser };
  }

  static async requestPlanChange({ tenantId, userId, planId, period, requestedAmount, accessCode, ipAddress }) {
    const plan = await TenantPlanRepository.findPlanById(planId);
    if (!plan || plan.status !== 'active') {
      throw new AppError('Target plan not found.', HTTP_STATUS.NOT_FOUND);
    }

    // Validate access code if plan is customized
    if (plan.customized) {
      if (!accessCode || plan.access_code !== accessCode) {
        throw new AppError('Valid access code required for customized plans.', HTTP_STATUS.FORBIDDEN);
      }
    }

    const formattedAmount = requestedAmount ? Math.round(Number(requestedAmount) * 100) : 0;

    const request = await TenantPlanRepository.createPlanRequest(tenantId, planId, {
      period: period || 'monthly',
      requested_amount: formattedAmount,
      access_code: accessCode || null
    });

    AuditService.logAction({
      tenantId,
      userId,
      action: 'REQUEST_PLAN_CHANGE',
      entityType: 'PLAN_REQUEST',
      entityId: request.plan_request_id,
      newValue: { planId, period, requestedAmount: formattedAmount },
      ipAddress
    });

    return request;
  }

  static async reviewPlanRequest({ userId, requestId, status, ipAddress }) {
    const request = await TenantPlanRepository.findPlanRequestById(requestId);
    if (!request) {
      throw new AppError('Plan request not found.', HTTP_STATUS.NOT_FOUND);
    }

    const validStatuses = ['approved', 'rejected', 'pending'];
    if (!validStatuses.includes(status)) {
      throw new AppError('Invalid request status.', HTTP_STATUS.BAD_REQUEST);
    }

    // If approved, update the tenant's active plan directly
    if (status === 'approved') {
      await db.tenant.update({
        where: { tenant_id: request.tenant_id },
        data: { plan_id: request.plan_id, updated_at: new Date() }
      });
    }

    const updatedRequest = await TenantPlanRepository.updatePlanRequestStatus(requestId, status);

    AuditService.logAction({
      tenantId: request.tenant_id,
      userId,
      action: `REVIEW_PLAN_REQUEST_${status.toUpperCase()}`,
      entityType: 'PLAN_REQUEST',
      entityId: requestId,
      oldValue: { status: request.status },
      newValue: { status },
      ipAddress
    });

    return updatedRequest;
  }

  static async listPlanRequests({ query }) {
    const { status, page = 1, limit = 50 } = query;
    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    const [total, requests] = await TenantPlanRepository.findPlanRequestsPaginated({
      status, skip, take
    });

    return {
      total,
      page: Number(page),
      pages: Math.ceil(total / limit),
      data: requests
    };
  }
}