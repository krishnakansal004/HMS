import { db } from '../config/db.js';
import { queryAcrossTenants } from '../config/systemOwnerRawClient.js';
export class TenantPlanRepository {

  // PLANS
  static async createPlan(data) {
    return await db.plan.create({
      data: {
        name: data.name,
        public: data.public ?? false,
        customized: data.customized ?? false,
        access_code: data.access_code || null,
        durations: data.durations || undefined,
        prices: data.prices || undefined,
        limits: data.limits || undefined,
        status: data.status || 'active',
      },
    });
  }

  static async findActivePlans() {
    return await db.plan.findMany({
      where: { status: 'active' },
      orderBy: { created_at: 'asc' },
    });
  }

  static async findPublicPlans() {
    return db.plan.findMany({
      where: { status: 'active', public: true },
      orderBy: { created_at: 'asc' },
    });
  }

  static async findPlanById(planId) {
    return await db.plan.findUnique({
      where: { plan_id: planId },
    });
  }

  // TENANTS
  static async createTenantTransaction(tenantData, adminUserData, adminRoleId) {
    return await db.$transaction(async (prisma) => {
      const tenant = await prisma.tenant.create({
        data: {
          name: tenantData.name,
          slug: tenantData.slug,
          plan_id: tenantData.plan_id,
          status: tenantData.status || 'active',
        },
      });

      // `users` IS in the RLS-scoped, FORCE-enabled table list. The db.$transaction wrapper only runs `set_config('app. current_tenant_id', ...)` when a tenantId already exists in AsyncLocalStorage -- but tenant provisioning is called from a public, pre-auth route (POST /api/tenants/provision, no `protect` middleware), so there is no tenant context yet, and the tenant_id being inserted for the admin user is one generated milliseconds ago by the tenant.create() call above.  Without this explicit set_config call, the users.create() below is rejected by Postgres's row-level security policy (tenant_id = NULL never matches), and onboarding a brand new hospital fails outright.

      // Added ::text cast to satisfy PostgreSQL strict typing
      await prisma.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenant.tenant_id}::text, true)`;

      // Provision the initial Hospital Admin user linked to this tenant
      const adminUser = await prisma.users.create({
        data: {
          tenant_id: tenant.tenant_id,
          role_id: adminRoleId,
          name: adminUserData.name,
          email: adminUserData.email,
          password_hash: adminUserData.passwordHash,
          must_change_password: true,
        },
      });

      return { tenant, adminUser };
    });
  }

  static async findPendingSignupBySlug(slug) {
    return db.tenant_signup.findFirst({
      where: { slug, status: { in: ["pending", "paid"] } },
    });
  }

  static async createTenantSignup(data) {
    return db.tenant_signup.create({ data });
  }

  static async attachRazorpayOrder(signupId, razorpayOrderId) {
    return db.tenant_signup.update({
      where: { signup_id: signupId },
      data: { razorpay_order_id: razorpayOrderId, updated_at: new Date() },
    });
  }

  static async failTenantSignup(signupId) {
    return db.tenant_signup.update({
      where: { signup_id: signupId },
      data: { status: "failed", updated_at: new Date() },
    });
  }

  static async findSignupByOrderId(razorpayOrderId) {
    return db.tenant_signup.findUnique({ where: { razorpay_order_id: razorpayOrderId } });
  }

  static async findTenantSignup(signupId) {
    return db.tenant_signup.findUnique({ where: { signup_id: signupId } });
  }

  static async provisionTenantFromSignup({
    signupId,
    adminRoleId,
    razorpayPaymentId,
    paymentSignature,
    paidAt,
  }) {
    return db.$transaction(async (tx) => {
      const [lockedSignup] = await tx.$queryRaw`
        SELECT * FROM tenant_signup
        WHERE signup_id = ${signupId}::uuid
        FOR UPDATE
      `;

      if (!lockedSignup) return null;
      if (lockedSignup.status === "provisioned" && lockedSignup.tenant_id) {
        const tenant = await tx.tenant.findUnique({
          where: { tenant_id: lockedSignup.tenant_id },
        });
        await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${lockedSignup.tenant_id}::text, true)`;
        const adminUser = await tx.users.findFirst({
          where: { tenant_id: lockedSignup.tenant_id, email: lockedSignup.admin_email },
        });
        return { tenant, adminUser, alreadyProvisioned: true };
      }

      const tenant = await tx.tenant.create({
        data: {
          name: lockedSignup.hospital_name,
          slug: lockedSignup.slug,
          plan_id: lockedSignup.plan_id,
          status: "active",
        },
      });

      // users is FORCE-RLS protected. Bind this transaction to the newly
      // created tenant before inserting the first hospital administrator.
      await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenant.tenant_id}::text, true)`;

      const adminUser = await tx.users.create({
        data: {
          tenant_id: tenant.tenant_id,
          role_id: adminRoleId,
          name: lockedSignup.admin_name,
          email: lockedSignup.admin_email,
          password_hash: lockedSignup.password_hash,
          must_change_password: true,
        },
      });

      await tx.tenant_signup.update({
        where: { signup_id: signupId },
        data: {
          tenant_id: tenant.tenant_id,
          status: "provisioned",
          razorpay_payment_id: razorpayPaymentId,
          payment_signature: paymentSignature || null,
          paid_at: paidAt || new Date(),
          updated_at: new Date(),
        },
      });

      return { tenant, adminUser, alreadyProvisioned: false };
    });
  }

  static async findTenantBySlug(slug) {
    return await db.tenant.findUnique({
      where: { slug },
      include: {
        plan: {
          select: {
            plan_id: true,
            name: true,
            limits: true,
          },
        },
      },
    });
  }

  static async findTenantById(tenantId) {
    return await db.tenant.findUnique({
      where: { tenant_id: tenantId },
      include: {
        plan: {
          select: {
            plan_id: true,
            name: true,
            limits: true,
          },
        },
      },
    });
  }

  // PLAN REQUESTS
  // (mounted, live, under /api/plan-requests) has been broken in exactly
  // the same "wrong accessor name" way as appointmentRepository.js's
  // raw-vs-wrapped-client bug from the last audit round.
  static async createPlanRequest(tenantId, planId, data) {
    return await db.plan_request.create({
      data: {
        tenant_id: tenantId,
        plan_id: planId,
        period: data.period || 'monthly',
        requested_amount: data.requested_amount || 0,
        access_code: data.access_code || null,
        status: 'pending',
      },
    });
  }

  static async findPlanRequestById(requestId) {
    return await db.plan_request.findUnique({
      where: { plan_request_id: requestId },
      include: {
        plan: {
          select: { name: true },
        },
        tenant: {
          select: { name: true, slug: true },
        },
      },
    });
  }

  static async updatePlanRequestStatus(requestId, status) {
    return await db.plan_request.update({
      where: { plan_request_id: requestId },
      data: {
        status,
        updated_at: new Date(),
      },
    });
  }

  static async findPlanRequestsPaginated({ userRole, status, skip, take }) {
    const whereCondition = status ? { status } : {};
   return queryAcrossTenants(userRole, async (tx) => {
    const [total, requests] = await Promise.all([
      tx.plan_request.count({ where: whereCondition }),
      tx.plan_request.findMany({
        where: whereCondition,
        include: {
          plan: { select: { name: true } },
          tenant: { select: { name: true, slug: true } },
        },
        orderBy: { created_at: 'desc' },
        skip,
        take,
      }),
    ]);
    return [total, requests];
  });
}

  static async findTenantsPaginated({ skip, take }) {
    return await db.$transaction(async (tx) => {
      const [total, tenants] = await Promise.all([
        tx.tenant.count(),
        tx.tenant.findMany({
          skip,
          take,
          include: { plan: { select: { name: true } } },
          orderBy: { created_at: 'desc' },
        }),
      ]);
      return [total, tenants];
    });
  }

  static async getTenantById({ tenantId }) {
    const tenant = await TenantPlanRepository.findTenantById(tenantId);
    if (!tenant) {
      throw new AppError('Tenant not found.', HTTP_STATUS.NOT_FOUND);
    }
    return tenant;
  }

  static async updateTenantStatus(tenantId, status) {
    return await db.tenant.update({
      where: { tenant_id: tenantId },
      data: { status, updated_at: new Date() }
    });
  }

  static async updateTenantPlan(tenantId, planId) {
    return await db.tenant.update({
      where: { tenant_id: tenantId },
      data: { plan_id: planId, updated_at: new Date() }
    });
  }
}
