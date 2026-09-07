import { db } from "../config/db.js";

export class AdmissionRepository {
  /**
   * @param {import('@prisma/client').Prisma.TransactionClient} [tx] Pass the
   *   transaction client when calling this from inside another
   *   db.$transaction() block (see AdmissionService.admitPatient) so the
   *   insert is actually part of that transaction rather than a separate
   *   connection outside it — defeating the point of wrapping it. Falls
   *   back to the top-level `db` client for any future non-transactional
   *   caller.
   */
  static async createAdmission(tenantId, data, tx) {
    const client = tx || db;
    return client.admission.create({
      data: {
        tenant_id: tenantId,
        ...data,
      },
      include: {
        patient: { select: { first_name: true, last_name: true } },
        bed: { select: { bed_number: true, ward_id: true } },
      },
    });
  }

  static async findAdmissionById(tenantId, admissionId) {
    return db.admission.findFirst({
      where: { admission_id: admissionId, tenant_id: tenantId, deleted_at: null },
      include: {
        patient: true,
        bed: true,
      },
    });
  }

  static async updateAdmissionTransaction({
    tenantId,
    admissionId,
    status,
    dischargeDate,
    dischargeNotes,
  }) {
    return db.$transaction(async (tx) => {
      const admission = await tx.admission.findFirst({
        where: { admission_id: admissionId, tenant_id: tenantId, deleted_at: null },
      });

      if (!admission) throw new Error("ADMISSION_NOT_FOUND");

      const updated = await tx.admission.update({
        where: { admission_id: admissionId },
        data: {
          status,
          discharge_date: dischargeDate
            ? new Date(dischargeDate)
            : status === "discharged"
              ? new Date()
              : undefined,
          discharge_notes: dischargeNotes || undefined,
          updated_at: new Date(),
        },
      });

      // If discharged, free up the bed automatically
      if (status === "discharged" && admission.bed_id) {
        await tx.bed.update({
          where: { bed_id: admission.bed_id },
          data: { is_occupied: false, patient_id: null },
        });
      }

      return updated;
    });
  }

  static async findAdmissionsPaginated({ tenantId, status, skip, take, patientId }) {
    const where = { tenant_id: tenantId, deleted_at: null };
    if (patientId) where.patient_id = patientId;
    if (status) where.status = status;

    // Converted to callback transaction
    return db.$transaction(async (tx) => {
      const [total, admissions] = await Promise.all([
        tx.admission.count({ where }),
        tx.admission.findMany({
          where,
          skip,
          take,
          orderBy: { admission_date: "desc" },
          include: {
            patient: { select: { first_name: true, last_name: true } },
            bed: { select: { bed_number: true } },
          },
        }),
      ]);
      return [total, admissions];
    });
  }
}
