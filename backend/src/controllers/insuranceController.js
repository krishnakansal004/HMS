import { InsuranceService } from "../services/insuranceService.js";
import { HTTP_STATUS } from "../constants/httpStatus.js";

export class InsuranceController {
  static async registerCompany(req, res, next) {
    try {
      const company = await InsuranceService.registerInsuranceCompany({
        tenantId: req.currentTenantId,
        userId: req.userId,
        data: req.body,
        ipAddress: req.ip,
      });

      res.status(HTTP_STATUS.CREATED).json({
        success: true,
        message: "Insurance company registered successfully",
        data: company,
      });
    } catch (error) {
      next(error);
    }
  }

  static async listCompanies(req, res, next) {
    try {
      const companies = await InsuranceService.listCompanies({
        tenantId: req.currentTenantId,
        userId: req.userId, 
        userRole: req.userRole
      });

      res.status(HTTP_STATUS.OK).json({
        success: true,
        data: companies,
      });
    } catch (error) {
      next(error);
    }
  }

  static async submitClaim(req, res, next) {
    try {
      const claim = await InsuranceService.submitClaim({
        tenantId: req.currentTenantId,
        userId: req.userId,
        ...req.body,
        ipAddress: req.ip,
      });

      res.status(HTTP_STATUS.CREATED).json({
        success: true,
        message: "Insurance claim submitted successfully",
        data: claim,
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateClaim(req, res, next) {
    try {
      const claim = await InsuranceService.updateClaimReview({
        tenantId: req.currentTenantId,
        userId: req.userId,
        claimId: req.params.id,
        status: req.body.status,
        approvedAmount: req.body.approvedAmount,
        rejectionReason: req.body.rejectionReason,
        settlementDate: req.body.settlementDate,
        ipAddress: req.ip,
      });

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: "Insurance claim status updated successfully",
        data: claim,
      });
    } catch (error) {
      next(error);
    }
  }

  static async listClaims(req, res, next) {
    try {
      const result = await InsuranceService.getClaims({
        tenantId: req.currentTenantId,
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
}
