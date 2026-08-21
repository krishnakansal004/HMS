import { db } from '../config/db.js';

export class TenantPlanRepository {

  // --- PLANS ---
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

  static async findPlanById(planId) {
    return await db.plan.findUnique({
      where: { plan_id: planId },
    });
  }

  // --- TENANTS ---
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

  static async findPlanRequestsPaginated({ status, skip, take }) {
    const whereCondition = status ? { status } : {};
    return db.$transaction(async (tx) => {
      const [total, requests] = await Promise.all([
        tx.plan_request.count({ where: whereCondition }),
        tx.plan_request.findMany({
          where: whereCondition,
          include: {
            plan: {
              select: { name: true },
            },
            tenant: {
              select: { name: true, slug: true },
            },
          },
          orderBy: { created_at: 'desc' },
          skip,
          take,
        }),
      ]);
      return [total, requests];
    });
  }
}
