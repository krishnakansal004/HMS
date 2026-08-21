import { InsuranceRepository } from '../repositories/insuranceRepository.js';
import { AuditService } from './auditService.js';
import { AppError } from '../middlewares/errorHandler.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';
import { db } from '../config/db.js';

export class InsuranceService {
  
  static async registerInsuranceCompany({ tenantId, userId, data, ipAddress }) {
    const company = await InsuranceRepository.createCompany(tenantId, {
      name: data.name,
      code: data.code,
      contact_person: data.contactPerson || null,
      email: data.email ? data.email.toLowerCase() : null,
      phone: data.phone || null,
      corporate_discount: data.corporateDiscount || 0,
      status: 'active'
    });

    AuditService.logAction({
      tenantId,
      userId,
      action: 'REGISTER_INSURANCE_COMPANY',
      entityType: 'INSURANCE_COMPANY',
      entityId: company.company_id,
      newValue: { name: company.name, code: company.code },
      ipAddress
    });

    return company;
  }

  static async listCompanies({ tenantId }) {
    return InsuranceRepository.findCompanies(tenantId);
  }

  static async submitClaim({ tenantId, userId, patientId, companyId, policyNumber, totalBillAmount, claimedAmount, invoiceId, ipAddress }) {
    // Verify Patient exists
    const patient = await db.patient.findFirst({
      where: { patient_id: patientId, tenant_id: tenantId }
    });
    if (!patient) {
      throw new AppError('Patient not found.', HTTP_STATUS.NOT_FOUND);
    }

    // Verify Insurance Company exists
    const company = await InsuranceRepository.findCompanyById(tenantId, companyId);
    if (!company || company.status !== 'active') {
      throw new AppError('Insurance company/TPA not found or inactive.', HTTP_STATUS.NOT_FOUND);
    }

    // Verify Invoice if provided
    if (invoiceId) {
      const invoice = await db.invoice.findFirst({
        where: { invoice_id: invoiceId, tenant_id: tenantId }
      });
      if (!invoice) {
        throw new AppError('Linked invoice not found.', HTTP_STATUS.NOT_FOUND);
      }
    }

    // Create Claim Record
    const claim = await InsuranceRepository.createClaim(tenantId, {
      patient_id: patientId,
      company_id: companyId,
      invoice_id: invoiceId || null,
      policy_number: policyNumber,
      total_bill_amount: totalBillAmount,
      claimed_amount: claimedAmount,
      status: 'submitted' // submitted -> under_review -> approved -> rejected -> settled
    });

    // Audit Logging
    AuditService.logAction({
      tenantId,
      userId,
      action: 'SUBMIT_INSURANCE_CLAIM',
      entityType: 'INSURANCE_CLAIM',
      entityId: claim.claim_id,
      newValue: { patientId, companyId, claimedAmount, policyNumber },
      ipAddress
    });

    return claim;
  }

  static async updateClaimReview({ tenantId, userId, claimId, status, approvedAmount, rejectionReason, settlementDate, ipAddress }) {
    const claim = await InsuranceRepository.findClaimById(tenantId, claimId);
    if (!claim) {
      throw new AppError('Insurance claim record not found.', HTTP_STATUS.NOT_FOUND);
    }

    const validStatuses = ['submitted', 'under_review', 'approved', 'rejected', 'settled'];
    if (!validStatuses.includes(status)) {
      throw new AppError('Invalid claim status workflow transition.', HTTP_STATUS.BAD_REQUEST);
    }

    const updatedClaim = await InsuranceRepository.updateClaimStatusTransaction({
      tenantId,
      claimId,
      status,
      approvedAmount,
      rejectionReason,
      settlementDate
    });

    AuditService.logAction({
      tenantId,
      userId,
      action: `UPDATE_INSURANCE_CLAIM_${status.toUpperCase()}`,
      entityType: 'INSURANCE_CLAIM',
      entityId: claimId,
      oldValue: { status: claim.status },
      newValue: { status, approvedAmount },
      ipAddress
    });

    return updatedClaim;
  }

  static async getClaims({ tenantId, query }) {
    const { patientId, status, page = 1, limit = 50 } = query;
    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    const [total, claims] = await InsuranceRepository.findClaimsPaginated({
      tenantId, patientId, status, skip, take
    });

    return {
      total,
      page: Number(page),
      pages: Math.ceil(total / limit),
      data: claims
    };
  }
}