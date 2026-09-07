import { TenantPlanService } from "../services/tenantPlanService.js";
import { HTTP_STATUS } from "../constants/httpStatus.js";

export class TenantPlanController {
  static async createPlan(req, res, next) {
    try {
      const plan = await TenantPlanService.createPlan({
        userId: req.userId,
        ...req.body,
        ipAddress: req.ip,
      });

      res.status(HTTP_STATUS.CREATED).json({
        success: true,
        message: "Subscription plan created successfully",
        data: plan,
      });
    } catch (error) {
      next(error);
    }
  }

  static async listPlans(req, res, next) {
    try {
      const plans = await TenantPlanService.listPlans();
      res.status(HTTP_STATUS.OK).json({
        success: true,
        data: plans,
      });
    } catch (error) {
      next(error);
    }
  }

  static async provision(req, res, next) {
    try {
      const result = await TenantPlanService.provisionHospitalTenant({
        ...req.body,
        ipAddress: req.ip,
      });

      res.status(HTTP_STATUS.CREATED).json({
        success: true,
        message: "Hospital tenant provisioned successfully",
        data: {
          tenant: result.tenant,
          adminEmail: result.adminUser.email,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  static async requestPlan(req, res, next) {
    try {
      const request = await TenantPlanService.requestPlanChange({
        tenantId: req.currentTenantId,
        userId: req.userId,
        ...req.body,
        ipAddress: req.ip,
      });

      res.status(HTTP_STATUS.CREATED).json({
        success: true,
        message: "Plan change request submitted successfully",
        data: request,
      });
    } catch (error) {
      next(error);
    }
  }

  static async reviewRequest(req, res, next) {
    try {
      const request = await TenantPlanService.reviewPlanRequest({
        userId: req.userId,
        requestId: req.params.id,
        status: req.body.status,
        ipAddress: req.ip,
      });

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: "Plan request reviewed successfully",
        data: request,
      });
    } catch (error) {
      next(error);
    }
  }

  static async listRequests(req, res, next) {
    try {
      const result = await TenantPlanService.listPlanRequests({
        query: req.query,
      });

      res.status(HTTP_STATUS.OK).json({
        success: true,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async listTenants(req, res, next) {
    try {
      const result = await TenantPlanService.listTenants({ query: req.query });
      res.status(HTTP_STATUS.OK).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }

  static async getTenant(req, res, next) {
    try {
      const tenant = await TenantPlanService.getTenantById({ tenantId: req.params.id });
      res.status(HTTP_STATUS.OK).json({ success: true, data: tenant });
    } catch (error) {
      next(error);
    }
  }

  static async updateStatus(req, res, next) {
    try {
      const tenant = await TenantPlanService.updateTenantStatus({
        userId: req.userId,
        tenantId: req.params.id,
        status: req.body.status,
        ipAddress: req.ip,
      });
      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: `Hospital access marked as ${req.body.status}`,
        data: tenant,
      });
    } catch (error) {
      next(error);
    }
  }

  static async updatePlan(req, res, next) {
    try {
      const tenant = await TenantPlanService.updateTenantPlan({
        userId: req.userId,
        tenantId: req.params.id,
        planId: req.body.planId,
        ipAddress: req.ip,
      });
      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: "Tenant plan updated successfully",
        data: tenant,
      });
    } catch (error) {
      next(error);
    }
  }
}
