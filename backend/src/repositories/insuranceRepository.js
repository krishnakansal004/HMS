import { db } from '../config/db.js';

export class InsuranceRepository {
  
  static async createCompany(tenantId, data) {
    return db.insurance_company.create({
      data: {
        tenant_id: tenantId,
        ...data
      }
    });
  }

  static async findCompanyById(tenantId, companyId) {
    return db.insurance_company.findFirst({
      where: { company_id: companyId, tenant_id: tenantId }
    });
  }

  static async findCompanies(tenantId) {
    return db.insurance_company.findMany({
      where: { tenant_id: tenantId },
      orderBy: { name: 'asc' }
    });
  }

  static async createClaim(tenantId, data) {
    return db.insurance_claim.create({
      data: {
        tenant_id: tenantId,
        ...data
      },
      include: {
        insurance_company: { select: { name: true, code: true } },
        patient: { select: { first_name: true, last_name: true, phone: true } }
      }
    });
  }

  static async findClaimById(tenantId, claimId) {
    return db.insurance_claim.findFirst({
      where: { claim_id: claimId, tenant_id: tenantId },
      include: {
        insurance_company: true,
        invoice: true,
        patient: { select: { first_name: true, last_name: true, email: true, phone: true } }
      }
    });
  }

  static async updateClaimStatusTransaction({ tenantId, claimId, status, approvedAmount, rejectionReason, settlementDate }) {
    return db.$transaction(async (tx) => {
      const updatedClaim = await tx.insurance_claim.update({
        where: { claim_id: claimId },
        data: {
          status,
          approved_amount: approvedAmount !== undefined ? approvedAmount : undefined,
          rejection_reason: rejectionReason !== undefined ? rejectionReason : undefined,
          settlement_date: settlementDate ? new Date(settlementDate) : undefined,
          updated_at: new Date()
        },
        include: { invoice: true }
      });

      // If claim is settled or approved and linked to an invoice, we can automate marking the invoice status
      if (status === 'settled' && updatedClaim.invoice_id) {
        const settledAmount = updatedClaim.approved_amount || updatedClaim.claimed_amount;
        
        await tx.invoice.update({
          where: { invoice_id: updatedClaim.invoice_id },
          data: {
            amount_paid: { increment: settledAmount },
            status: 'paid' // Or partial depending on full comparison
          }
        });
      }

      return updatedClaim;
    });
  }

  static async findClaimsPaginated({ tenantId, patientId, status, skip, take }) {
    const where = { tenant_id: tenantId };
    if (patientId) where.patient_id = patientId;
    if (status) where.status = status;

    return db.$transaction([
      db.insurance_claim.count({ where }),
      db.insurance_claim.findMany({
        where,
        skip,
        take,
        orderBy: { created_at: 'desc' },
        include: {
          insurance_company: { select: { name: true, code: true } },
          patient: { select: { first_name: true, last_name: true, mrn: true } }
        }
      })
    ]);
  }
}