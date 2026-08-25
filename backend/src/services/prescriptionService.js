import { PrescriptionRepository } from "../repositories/prescriptionRepository.js";
import { AuditService } from "./auditService.js";
import { AppError } from "../middlewares/errorHandler.js";
import { HTTP_STATUS } from "../constants/httpStatus.js";
import { db } from "../config/db.js";

export class PrescriptionService {
  static async createPrescription({
    tenantId,
    userId,
    doctorProfileId,
    patientId,
    appointmentId,
    diagnosis,
    instructions,
    items,
    ipAddress,
  }) {
    // Verify Patient exists in this tenant
    const patient = await db.patient.findFirst({
      where: { patient_id: patientId, tenant_id: tenantId },
    });
    if (!patient) {
      throw new AppError("Patient not found.", HTTP_STATUS.NOT_FOUND);
    }

    // Business Rule: Medicine stock must NOT decrease here (enforced by design: we only write to prescription table)
    const prescription = await PrescriptionRepository.create({
      tenantId,
      doctorId: doctorProfileId,
      patientId,
      appointmentId,
      diagnosis,
      instructions,
      items,
    });

    // Update snapshot name directly via a quick patch to satisfy schema snapshot requirements
    await db.prescription.update({
      where: { prescription_id: prescription.prescription_id },
      data: {
        patient_name_snapshot:
          `${patient.first_name} ${patient.last_name || ""}`.trim(),
      },
    });

    AuditService.logAction({
      tenantId,
      userId,
      action: "CREATE_PRESCRIPTION",
      entityType: "PRESCRIPTION",
      entityId: prescription.prescription_id,
      newValue: { patientId, diagnosis, itemCount: items.length },
      ipAddress,
    });

    return prescription;
  }

  static async getPrescriptionById({ tenantId, prescriptionId }) {
    const prescription = await PrescriptionRepository.findByIdAndTenant(
      prescriptionId,
      tenantId,
    );
    if (!prescription) {
      throw new AppError("Prescription not found.", HTTP_STATUS.NOT_FOUND);
    }
    return prescription;
  }

  static async updateApproval({
    tenantId,
    userId,
    prescriptionId,
    status,
    ipAddress,
  }) {
    const prescription = await PrescriptionRepository.findByIdAndTenant(
      prescriptionId,
      tenantId,
    );
    if (!prescription) {
      throw new AppError("Prescription not found.", HTTP_STATUS.NOT_FOUND);
    }

    const validStatuses = ["pending", "approved", "rejected"];
    if (!validStatuses.includes(status)) {
      throw new AppError("Invalid approval status.", HTTP_STATUS.BAD_REQUEST);
    }

    await PrescriptionRepository.updateApprovalStatus(
      prescriptionId,
      tenantId,
      status,
    );

    AuditService.logAction({
      tenantId,
      userId,
      action: `PRESCRIPTION_${status.toUpperCase()}`,
      entityType: "PRESCRIPTION",
      entityId: prescriptionId,
      oldValue: { approval_status: prescription.approval_status },
      newValue: { approval_status: status },
      ipAddress,
    });

    return { prescription_id: prescriptionId, approval_status: status };
  }

  static async listPrescriptions({ tenantId, query }) {
    const { patientId, doctorId, page = 1, limit = 50 } = query;
    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    const [total, prescriptions] =
      await PrescriptionRepository.findManyPaginated({
        tenantId,
        patientId,
        doctorId,
        skip,
        take,
      });

    return {
      total,
      page: Number(page),
      pages: Math.ceil(total / limit),
      data: prescriptions,
    };
  }
}
