import { AdmissionRepository } from "../repositories/admissionRepository.js";
import { AuditService } from "./auditService.js";
import { AppError } from "../middlewares/errorHandler.js";
import { HTTP_STATUS } from "../constants/httpStatus.js";
import { db } from "../config/db.js";

export class AdmissionService {
  static async admitPatient({
    tenantId,
    userId,
    patientId,
    bedId,
    admittingDoctorId,
    diagnosis,
    ipAddress,
  }) {
    // this used to do the bed lock (db.bed.update) and the
    // admission record creation (AdmissionRepository.createAdmission) as
    // two separate, un-transactioned writes. If the second failed after
    // the first succeeded — a validation error, a dropped connection,
    // anything — the bed would be left marked occupied with no admission
    // record to justify it, and there'd be no way to tell that had
    // happened short of noticing the bed was stuck. Wrapped in a single
    // db.$transaction so it's all-or-nothing, matching the pattern
    // already used correctly elsewhere in this file's sibling
    // (updateAdmissionTransaction) and in wardBedRepository.js.
    const admission = await db.$transaction(async (tx) => {
      // Verify patient exists
      const patient = await tx.patient.findFirst({
        where: { patient_id: patientId, tenant_id: tenantId },
      });
      if (!patient)
        throw new AppError("Patient not found.", HTTP_STATUS.NOT_FOUND);

      // If bed is specified, check if it's free, then lock it
      if (bedId) {
        const bed = await tx.bed.findFirst({
          where: { bed_id: bedId, tenant_id: tenantId },
        });
        if (!bed) throw new AppError("Bed not found.", HTTP_STATUS.NOT_FOUND);
        if (bed.is_occupied)
          throw new AppError(
            "Selected bed is already occupied.",
            HTTP_STATUS.CONFLICT,
          );

        await tx.bed.update({
          where: { bed_id: bedId },
          data: { is_occupied: true, patient_id: patientId },
        });
      }

      // Create the admission record
      return AdmissionRepository.createAdmission(
        tenantId,
        {
          patient_id: patientId,
          bed_id: bedId || null,
          admitting_doctor_id: admittingDoctorId || null,
          diagnosis: diagnosis || null,
          admission_date: new Date(),
          status: "admitted",
        },
        tx,
      );
    });

    AuditService.logAction({
      tenantId,
      userId,
      action: "ADMIT_PATIENT",
      entityType: "ADMISSION",
      entityId: admission.admission_id,
      newValue: { patientId, bedId, diagnosis },
      ipAddress,
    });

    return admission;
  }

  static async updateAdmission({
    tenantId,
    userId,
    admissionId,
    status,
    dischargeDate,
    dischargeNotes,
    ipAddress,
  }) {
    try {
      const admission = await AdmissionRepository.updateAdmissionTransaction({
        tenantId,
        admissionId,
        status,
        dischargeDate,
        dischargeNotes,
      });

      AuditService.logAction({
        tenantId,
        userId,
        action: `UPDATE_ADMISSION_${status}`,
        entityType: "ADMISSION",
        entityId: admissionId,
        newValue: { status },
        ipAddress,
      });

      return admission;
    } catch (error) {
      if (error.message === "ADMISSION_NOT_FOUND") {
        throw new AppError(
          "Admission record not found.",
          HTTP_STATUS.NOT_FOUND,
        );
      }
      throw error;
    }
  }

  static async getAdmissions({ tenantId, query }) {
    const { status, page = 1, limit = 50 } = query;
    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    const [total, admissions] =
      await AdmissionRepository.findAdmissionsPaginated({
        tenantId,
        status,
        skip,
        take,
      });

    return {
      total,
      page: Number(page),
      pages: Math.ceil(total / limit),
      data: admissions,
    };
  }
}
