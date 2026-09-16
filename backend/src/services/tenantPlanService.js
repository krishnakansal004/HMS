import { TenantPlanRepository } from "../repositories/tenantPlanRepository.js";
import { AuditService } from "./auditService.js";
import { AppError } from "../middlewares/errorHandler.js";
import { HTTP_STATUS } from "../constants/httpStatus.js";
import { db } from "../config/db.js";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import Razorpay from "razorpay";
import { env } from "../config/env.js";
import { getMissingPlanContractFields, hasCompletePlanContract, normalizePlanLimits } from "../config/planEntitlements.js";

export class TenantPlanService {
  static getPublicPlanAmount(plan, billingPeriod = "monthly") {
    const prices = plan?.prices && typeof plan.prices === "object" ? plan.prices : {};
    const monthly = Number(prices.monthly || 0);
    const yearly = Number(prices.yearly ?? monthly * 12);
    const fallbackAmounts = {
      monthly,
      '3months': monthly * 3,
      yearly,
      '5years': yearly * 5,
    };
    const rawAmount = prices[billingPeriod] ?? fallbackAmounts[billingPeriod];
    const amount = Number(rawAmount || 0);
    if (!Number.isFinite(amount) || amount < 0) {
      throw new AppError("Selected plan has invalid pricing.", HTTP_STATUS.BAD_REQUEST);
    }
    return Math.round(amount * 100);
  }

  static getRazorpayClient() {
    return new Razorpay({ key_id: env.razorpay.keyId, key_secret: env.razorpay.keySecret });
  }

  static secureCompare(left, right) {
    const a = Buffer.from(String(left || ""));
    const b = Buffer.from(String(right || ""));
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }

  static async startPublicProvisioning({
    name,
    slug,
    planId,
    adminName,
    adminEmail,
    adminPassword,
    billingPeriod = "monthly",
    ipAddress,
  }) {
    const plan = await TenantPlanRepository.findPlanById(planId);
    if (!plan || plan.status !== "active" || !plan.public || !hasCompletePlanContract(plan)) {
      throw new AppError("Selected plan is not available for public signup.", HTTP_STATUS.BAD_REQUEST);
    }

    const normalizedSlug = slug.toLowerCase().trim();
    const existingTenant = await TenantPlanRepository.findTenantBySlug(normalizedSlug);
    if (existingTenant) {
      throw new AppError("Hospital portal slug is already taken. Choose another.", HTTP_STATUS.CONFLICT);
    }
    const existingSignup = await TenantPlanRepository.findPendingSignupBySlug(normalizedSlug);
    if (existingSignup) {
      throw new AppError("A signup is already in progress for this hospital slug.", HTTP_STATUS.CONFLICT);
    }

    const amountPaise = this.getPublicPlanAmount(plan, billingPeriod);
    if (amountPaise === 0) {
      const result = await this.provisionHospitalTenant({
        name,
        slug: normalizedSlug,
        planId,
        adminName,
        adminEmail,
        adminPassword,
        ipAddress,
      });
      return {
        paymentRequired: false,
        tenant: result.tenant,
        adminEmail: result.adminUser.email,
      };
    }

    const passwordHash = await bcrypt.hash(adminPassword, 12);
    const signup = await TenantPlanRepository.createTenantSignup({
      plan_id: planId,
      hospital_name: name,
      slug: normalizedSlug,
      admin_name: adminName,
      admin_email: adminEmail.toLowerCase().trim(),
      password_hash: passwordHash,
      billing_period: billingPeriod,
      amount_paise: amountPaise,
      currency: "INR",
      status: "pending",
      expires_at: new Date(Date.now() + 30 * 60 * 1000),
    });

    try {
      const order = await this.getRazorpayClient().orders.create({
        amount: amountPaise,
        currency: "INR",
        receipt: signup.signup_id,
        notes: { signup_id: signup.signup_id, plan_id: planId },
      });
      await TenantPlanRepository.attachRazorpayOrder(signup.signup_id, order.id);

      return {
        paymentRequired: true,
        signupId: signup.signup_id,
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        keyId: env.razorpay.keyId,
        prefill: { name: adminName, email: adminEmail },
        planName: plan.name,
      };
    } catch (error) {
      await TenantPlanRepository.failTenantSignup(signup.signup_id);
      throw error;
    }
  }

  static async fetchCapturedPayment(signup, paymentId) {
    let payment;
    try {
      payment = await this.getRazorpayClient().payments.fetch(paymentId);
    } catch {
      throw new AppError("Payment could not be verified with Razorpay.", HTTP_STATUS.BAD_REQUEST);
    }
    if (
      payment.order_id !== signup.razorpay_order_id ||
      Number(payment.amount) !== Number(signup.amount_paise) ||
      payment.currency !== signup.currency ||
      payment.status !== "captured"
    ) {
      throw new AppError("Payment is not captured for this signup order.", HTTP_STATUS.BAD_REQUEST);
    }
    return payment;
  }

  static async completePaidSignup({ signup, payment, paymentId, paymentSignature = null }) {
    const adminRole = await db.role.findUnique({ where: { name: "HOSPITAL_ADMIN" } });
    if (!adminRole) {
      throw new AppError("System configuration error: HOSPITAL_ADMIN role missing.", HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }

    const result = await TenantPlanRepository.provisionTenantFromSignup({
      signupId: signup.signup_id,
      adminRoleId: adminRole.role_id,
      razorpayPaymentId: paymentId,
      razorpaySubscriptionId: payment?.subscription_id || null,
      paymentSignature,
      paidAt: new Date(),
    });
    if (!result?.tenant) {
      throw new AppError("Signup could not be completed.", HTTP_STATUS.NOT_FOUND);
    }

    AuditService.logAction({
      tenantId: result.tenant.tenant_id,
      userId: result.adminUser?.user_id,
      action: "PROVISION_PAID_HOSPITAL_TENANT",
      entityType: "TENANT",
      entityId: result.tenant.tenant_id,
      newValue: {
        planId: signup.plan_id,
        signupId: signup.signup_id,
        razorpayPaymentId: paymentId,
        amountPaise: signup.amount_paise,
      },
    });

    return { tenant: result.tenant, adminEmail: signup.admin_email };
  }

  static async verifyPublicProvisionPayment({
    signupId,
    razorpayPaymentId,
    razorpayOrderId,
    razorpaySignature,
  }) {
    const signup = await TenantPlanRepository.findTenantSignup(signupId);
    if (!signup) throw new AppError("Signup not found.", HTTP_STATUS.NOT_FOUND);
    if (signup.status === "provisioned") {
      const tenant = await TenantPlanRepository.findTenantById(signup.tenant_id);
      return { tenant, adminEmail: signup.admin_email };
    }
    if (signup.status !== "pending" || !signup.razorpay_order_id) {
      throw new AppError("This signup payment is no longer available.", HTTP_STATUS.BAD_REQUEST);
    }
    if (new Date(signup.expires_at) <= new Date()) {
      await TenantPlanRepository.failTenantSignup(signup.signup_id);
      throw new AppError("This signup payment session has expired. Please start again.", HTTP_STATUS.BAD_REQUEST);
    }
    if (signup.razorpay_order_id !== razorpayOrderId) {
      throw new AppError("Razorpay order does not match this signup.", HTTP_STATUS.BAD_REQUEST);
    }

    const expectedSignature = crypto
      .createHmac("sha256", env.razorpay.keySecret)
      .update(`${signup.razorpay_order_id}|${razorpayPaymentId}`)
      .digest("hex");
    if (!this.secureCompare(expectedSignature, razorpaySignature)) {
      throw new AppError("Cryptographic signature verification failed.", HTTP_STATUS.UNAUTHORIZED);
    }

    const payment = await this.fetchCapturedPayment(signup, razorpayPaymentId);
    return this.completePaidSignup({
      signup,
      payment,
      paymentId: razorpayPaymentId,
      paymentSignature: razorpaySignature,
    });
  }

  static async handlePublicProvisionWebhook({ rawBody, webhookSignature, payload }) {
    if (!rawBody || !webhookSignature) {
      throw new AppError("Missing Razorpay webhook signature.", HTTP_STATUS.UNAUTHORIZED);
    }
    const expectedSignature = crypto
      .createHmac("sha256", env.razorpay.webhookSecret)
      .update(rawBody)
      .digest("hex");
    if (!this.secureCompare(expectedSignature, webhookSignature)) {
      throw new AppError("Invalid Razorpay webhook signature.", HTTP_STATUS.UNAUTHORIZED);
    }

    if (!['payment.captured', 'order.paid'].includes(payload?.event)) {
      return { ignored: true };
    }
    const payloadPayment = payload?.payload?.payment?.entity;
    const order = payload?.payload?.order?.entity;
    const orderId = payloadPayment?.order_id || order?.id;
    const paymentId = payloadPayment?.id;
    if (!orderId || !paymentId) return { ignored: true };

    const signup = await TenantPlanRepository.findSignupByOrderId(orderId);
    if (!signup) return { ignored: true };
    if (signup.status === "provisioned") return { alreadyProcessed: true };

    const payment = await this.fetchCapturedPayment(signup, paymentId);
    await this.completePaidSignup({ signup, payment, paymentId });
    return { processed: true };
  }

  static async createPlan({
    userRole,
    userId,
    name,
    publicFlag,
    customized,
    accessCode,
    durations,
    prices,
    limits,
    ipAddress,
  }) {
    const missingFields = getMissingPlanContractFields(limits);
    if (missingFields.length > 0) {
      throw new AppError(
        `Every plan must explicitly define these limits and entitlements: ${missingFields.join(', ')}.`,
        HTTP_STATUS.BAD_REQUEST,
      );
    }
    const normalizedLimits = normalizePlanLimits(limits);

    const plan = await TenantPlanRepository.createPlan({
      name,
      public: publicFlag || false,
      customized: customized || false,
      access_code: accessCode || null,
      durations: durations ? JSON.parse(JSON.stringify(durations)) : undefined,
      prices: prices ? JSON.parse(JSON.stringify(prices)) : undefined,
      limits: JSON.parse(JSON.stringify(normalizedLimits)),
      status: "active",
    }, userRole);

    AuditService.logAction({
      tenantId: null, // Global action
      userId,
      action: "CREATE_SUBSCRIPTION_PLAN",
      entityType: "PLAN",
      entityId: plan.plan_id,
      newValue: { name, limits: normalizedLimits },
      ipAddress,
    });

    return plan;
  }

  static async updatePlan({
    planId,
    userRole,
    userId,
    name,
    publicFlag,
    customized,
    accessCode,
    durations,
    prices,
    limits,
    status,
    ipAddress,
  }) {
    const missingFields = getMissingPlanContractFields(limits);
    if (missingFields.length > 0) {
      throw new AppError(
        `Every plan must explicitly define these limits and entitlements: ${missingFields.join(', ')}.`,
        HTTP_STATUS.BAD_REQUEST,
      );
    }
    const normalizedLimits = normalizePlanLimits(limits);

    const existing = await TenantPlanRepository.findPlanByIdAcrossTenants(planId, userRole);
    if (!existing) throw new AppError('Plan not found.', HTTP_STATUS.NOT_FOUND);

    const updateData = {
      limits: JSON.parse(JSON.stringify(normalizedLimits)),
      updated_at: new Date(),
    };
    if (name !== undefined) updateData.name = name;
    if (publicFlag !== undefined) updateData.public = publicFlag;
    if (customized !== undefined) updateData.customized = customized;
    if (accessCode !== undefined) updateData.access_code = accessCode || null;
    if (durations !== undefined) updateData.durations = durations ? JSON.parse(JSON.stringify(durations)) : null;
    if (prices !== undefined) updateData.prices = prices ? JSON.parse(JSON.stringify(prices)) : null;
    if (status !== undefined) updateData.status = status;

    const plan = await TenantPlanRepository.updatePlan(planId, updateData, userRole);

    AuditService.logAction({
      tenantId: null,
      userId,
      action: "UPDATE_SUBSCRIPTION_PLAN",
      entityType: "PLAN",
      entityId: plan.plan_id,
      oldValue: { name: existing.name, limits: existing.limits },
      newValue: { name: plan.name, limits: normalizedLimits },
      ipAddress,
    });

    return plan;
  }

  static async listPlans({ userRole } = {}) {
    return TenantPlanRepository.findActivePlans(userRole);
  }

  static async listPublicPlans() {
    const plans = await TenantPlanRepository.findPublicPlans();
    // An incomplete plan is an internal configuration issue, not a public
    // pricing tier. Never advertise guessed limits or implicit access.
    return plans.filter(hasCompletePlanContract);
  }

  static async updateTenantStatus({ userId, userRole, tenantId, status, ipAddress }) {
    const validStatuses = ["active", "suspended", "cancelled"];
    if (!validStatuses.includes(status)) {
      throw new AppError("Invalid tenant status.", HTTP_STATUS.BAD_REQUEST);
    }

    const tenant = await TenantPlanRepository.findTenantByIdAcrossTenants(tenantId, userRole);
    if (!tenant) throw new AppError("Tenant not found.", HTTP_STATUS.NOT_FOUND);

    const updatedTenant = await TenantPlanRepository.updateTenantStatus(tenantId, status, userRole);

    AuditService.logAction({
      tenantId, 
      userId,
      action: `UPDATE_TENANT_STATUS_${status.toUpperCase()}`,
      entityType: "TENANT",
      entityId: tenantId,
      oldValue: { status: tenant.status },
      newValue: { status },
      ipAddress,
    });

    return updatedTenant;
  }

  static async updateTenantPlan({ userId, userRole, tenantId, planId, ipAddress }) {
    const plan = await TenantPlanRepository.findPlanByIdAcrossTenants(planId, userRole);
    if (!plan || plan.status !== "active" || !hasCompletePlanContract(plan)) {
      throw new AppError("Selected plan is invalid or inactive.", HTTP_STATUS.BAD_REQUEST);
    }
    
    const tenant = await TenantPlanRepository.findTenantByIdAcrossTenants(tenantId, userRole);
    if (!tenant) throw new AppError("Tenant not found.", HTTP_STATUS.NOT_FOUND);

    const updatedTenant = await TenantPlanRepository.updateTenantPlan(tenantId, planId, userRole);

    AuditService.logAction({
      tenantId,
      userId,
      action: "UPDATE_TENANT_PLAN",
      entityType: "TENANT",
      entityId: tenantId,
      oldValue: { planId: tenant.plan_id },
      newValue: { planId },
      ipAddress,
    });

    return updatedTenant;
  }

  static async provisionHospitalTenant({
    userRole,
    name,
    slug,
    planId,
    adminName,
    adminEmail,
    adminPassword,
    ipAddress,
  }) {
    // Verify Plan exists
    const plan = await TenantPlanRepository.findPlanById(planId);
    if (!plan || plan.status !== "active" || !hasCompletePlanContract(plan)) {
      throw new AppError(
        "Selected subscription plan is invalid or inactive.",
        HTTP_STATUS.BAD_REQUEST,
      );
    }

    // Check if slug is taken
    const existingTenant = await TenantPlanRepository.findTenantBySlug(slug);
    if (existingTenant) {
      throw new AppError(
        "Hospital portal slug is already taken. Choose another.",
        HTTP_STATUS.CONFLICT,
      );
    }

    // Resolve Hospital Admin role ID
    const adminRole = await db.role.findUnique({
      where: { name: "HOSPITAL_ADMIN" },
    });
    if (!adminRole) {
      throw new AppError(
        "System configuration error: HOSPITAL_ADMIN role missing.",
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
      );
    }

    // Hash password
    const passwordHash = await bcrypt.hash(adminPassword, 12);

    // Execute Provisioning Transaction
    const { tenant, adminUser } =
      await TenantPlanRepository.createTenantTransaction(
        {
          name,
          slug: slug.toLowerCase().trim(),
          plan_id: planId,
          status: "active",
        },
        {
          name: adminName,
          email: adminEmail.toLowerCase().trim(),
          passwordHash,
        },
        adminRole.role_id,
        userRole,
      );

    AuditService.logAction({
      tenantId: tenant.tenant_id,
      userId: adminUser.user_id,
      action: "PROVISION_HOSPITAL_TENANT",
      entityType: "TENANT",
      entityId: tenant.tenant_id,
      newValue: { name, slug, planId },
      ipAddress,
    });

    return { tenant, adminUser };
  }

  static async requestPlanChange({
    tenantId,
    userId,
    planId,
    period,
    accessCode,
    ipAddress,
  }) {
    const plan = await TenantPlanRepository.findPlanById(planId);
    if (!plan || plan.status !== "active" || !hasCompletePlanContract(plan) || (!plan.public && !plan.customized)) {
      throw new AppError("Target plan not found.", HTTP_STATUS.NOT_FOUND);
    }

    // Validate access code if plan is customized
    if (plan.customized) {
      if (!accessCode || plan.access_code !== accessCode) {
        throw new AppError(
          "Valid access code required for customized plans.",
          HTTP_STATUS.FORBIDDEN,
        );
      }
    }

    // The browser may display a price, but it must never decide what a plan
    // request is worth. Keep the stored amount server-authoritative.
    const formattedAmount = this.getPublicPlanAmount(plan, period || 'monthly');

    const request = await TenantPlanRepository.createPlanRequest(
      tenantId,
      planId,
      {
        period: period || "monthly",
        requested_amount: formattedAmount,
        access_code: accessCode || null,
      },
    );

    AuditService.logAction({
      tenantId,
      userId,
      action: "REQUEST_PLAN_CHANGE",
      entityType: "PLAN_REQUEST",
      entityId: request.plan_request_id,
      newValue: { planId, period, requestedAmount: formattedAmount },
      ipAddress,
    });

    return request;
  }

  static async reviewPlanRequest({ userId, userRole, requestId, status, ipAddress }) {
    const validStatuses = ["approved", "rejected", "pending"];
    if (!validStatuses.includes(status)) {
      throw new AppError("Invalid request status.", HTTP_STATUS.BAD_REQUEST);
    }

    const reviewResult = await TenantPlanRepository.reviewPlanRequestAcrossTenants({
      requestId, status, userRole,
    });
    if (!reviewResult) throw new AppError("Plan request not found.", HTTP_STATUS.NOT_FOUND);
    const { request, updatedRequest } = reviewResult;

    AuditService.logAction({
      tenantId: request.tenant_id,
      userId,
      action: `REVIEW_PLAN_REQUEST_${status.toUpperCase()}`,
      entityType: "PLAN_REQUEST",
      entityId: requestId,
      oldValue: { status: request.status },
      newValue: { status },
      ipAddress,
    });

    return updatedRequest;
  }

static async listPlanRequests({ userRole, query }) {
    const { status, page = 1, limit = 50 } = query;
    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    const [total, requests] =
    await TenantPlanRepository.findPlanRequestsPaginated({
      userRole,
      status,
        skip,
        take,
      });

    return {
      total,
      page: Number(page),
      pages: Math.ceil(total / limit),
      data: requests,
    };
  }

  static async getTenantById({ tenantId, userRole }) {
    // The repository method expects a direct string, not an object
    const tenant = await TenantPlanRepository.findTenantByIdAcrossTenants(tenantId, userRole);
    if (!tenant) {
      throw new AppError('Tenant not found.', HTTP_STATUS.NOT_FOUND);
    }
    return tenant;
  }

  static async listTenants({ userRole, query }) {
    const { page = 1, limit = 50 } = query;
    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);
    const [total, tenants] = await TenantPlanRepository.findTenantsPaginated({ userRole, skip, take });
    return {
      total,
      page: Number(page),
      pages: Math.ceil(total / limit),
      data: tenants
    };
  }
}
