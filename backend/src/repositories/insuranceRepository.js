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
      where: { company_id: companyId, tenant_id: tenantId, deleted_at: null }
    });
  }

  static async findCompanies(tenantId) {
    return db.insurance_company.findMany({
      where: { tenant_id: tenantId, deleted_at: null },
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
      where: { claim_id: claimId, tenant_id: tenantId, deleted_at: null },
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

      // Dynamically evaluate if the settled claim actually covers the full invoice
      if (status === 'settled' && updatedClaim.invoice_id) {
        const settledAmount = updatedClaim.approved_amount || updatedClaim.claimed_amount;
        
        // Atomically increment the paid amount
        const atomicInvoice = await tx.invoice.update({
          where: { invoice_id: updatedClaim.invoice_id },
          data: {
            amount_paid: { increment: settledAmount }
          },
          select: { total: true, amount_paid: true }
        });

        // Strictly evaluate the new balance
        const newStatus = Number(atomicInvoice.amount_paid) >= Number(atomicInvoice.total) ? 'paid' : 'partial';

        await tx.invoice.update({
          where: { invoice_id: updatedClaim.invoice_id },
          data: { 
            status: newStatus,
            paid: newStatus === 'paid'
          }
        });
      }

      return updatedClaim;
    });
  }

  static async findClaimsPaginated({ tenantId, patientId, status, skip, take }) {
    const where = { tenant_id: tenantId, deleted_at: null };
    if (patientId) where.patient_id = patientId;
    if (status) where.status = status;

    return db.$transaction(async (tx) => {
      const [total, claims] = await Promise.all([
        tx.insurance_claim.count({ where }),
        tx.insurance_claim.findMany({
          where,
          skip,
          take,
          orderBy: { created_at: 'desc' },
          include: {
            insurance_company: { select: { name: true, code: true } },
            patient: { select: { first_name: true, last_name: true } }
          }
        })
      ]);
      return [total, claims];
    });
  }
}