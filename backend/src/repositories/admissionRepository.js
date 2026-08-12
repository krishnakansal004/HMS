import { db } from '../config/db.js';

export class AdmissionRepository {
  static async createAdmission(tenantId, data) {
    return db.admission.create({
      data: {
        tenant_id: tenantId,
        ...data
      },
      include: {
        patient: { select: { first_name: true, last_name: true, mrn: true } },
        bed: { select: { bed_number: true, ward_id: true } }
      }
    });
  }

  static async findAdmissionById(tenantId, admissionId) {
    return db.admission.findFirst({
      where: { admission_id: admissionId, tenant_id: tenantId },
      include: {
        patient: true,
        bed: true
      }
    });
  }

  static async updateAdmissionTransaction({ tenantId, admissionId, status, dischargeDate, dischargeNotes }) {
    return db.$transaction(async (tx) => {
      const admission = await tx.admission.findFirst({
        where: { admission_id: admissionId, tenant_id: tenantId }
      });

      if (!admission) throw new Error('ADMISSION_NOT_FOUND');

      const updated = await tx.admission.update({
        where: { admission_id: admissionId },
        data: {
          status,
          discharge_date: dischargeDate ? new Date(dischargeDate) : (status === 'DISCHARGED' ? new Date() : undefined),
          discharge_notes: dischargeNotes || undefined,
          updated_at: new Date()
        }
      });

      // If discharged, free up the bed automatically
      if (status === 'DISCHARGED' && admission.bed_id) {
        await tx.bed.update({
          where: { bed_id: admission.bed_id },
          data: { is_occupied: false, patient_id: null }
        });
      }

      return updated;
    });
  }

  static async findAdmissionsPaginated({ tenantId, status, skip, take }) {
    const where = { tenant_id: tenantId };
    if (status) where.status = status;

    return db.$transaction([
      db.admission.count({ where }),
      db.admission.findMany({
        where,
        skip,
        take,
        orderBy: { admission_date: 'desc' },
        include: {
          patient: { select: { first_name: true, last_name: true, mrn: true } },
          bed: { select: { bed_number: true } }
        }
      })
    ]);
  }
}