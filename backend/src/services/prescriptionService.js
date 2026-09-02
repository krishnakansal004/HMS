import { PrescriptionRepository } from '../repositories/prescriptionRepository.js';
import { DoctorRepository } from '../repositories/doctorRepository.js';
import { AuditService } from './auditService.js';
import { AppError } from '../middlewares/errorHandler.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';
import { db } from '../config/db.js';

export class PrescriptionService {

  // The route only allows the DOCTOR role to create a prescription, but the
  // doctorProfileId used to be taken straight from the request body — any
  // doctor could attribute a prescription to any other doctor's profile
  // just by sending a different id. Deriving it from the caller's own
  // account here removes that trust boundary entirely; the client can no
  // longer influence whose profile a prescription lands under.
  static async createPrescription({ tenantId, userId, patientId, appointmentId, diagnosis, instructions, items, ipAddress }) {
    const doctorProfile = await DoctorRepository.findProfileByUserId(tenantId, userId);
    if (!doctorProfile) {
      throw new AppError('No doctor profile is associated with this account.', HTTP_STATUS.FORBIDDEN);
    }
    const doctorProfileId = doctorProfile.doctor_profile_id;

    // Verify Patient exists in this tenant
    const patient = await db.patient.findFirst({
      where: { patient_id: patientId, tenant_id: tenantId }
    });
    if (!patient) {
      throw new AppError('Patient not found.', HTTP_STATUS.NOT_FOUND);
    }

    // Business Rule: Medicine stock must NOT decrease here (enforced by design: we only write to prescription table)
    const prescription = await PrescriptionRepository.create({
      tenantId,
      doctorId: doctorProfileId,
      patientId,
      appointmentId,
      diagnosis,
      instructions,
      items
    });

    // Update snapshot name directly via a quick patch to satisfy schema snapshot requirements
    await db.prescription.update({
      where: { prescription_id: prescription.prescription_id },
      data: { patient_name_snapshot: `${patient.first_name} ${patient.last_name || ''}`.trim() }
    });

    AuditService.logAction({
      tenantId,
      userId,
      action: 'CREATE_PRESCRIPTION',
      entityType: 'PRESCRIPTION',
      entityId: prescription.prescription_id,
      newValue: { patientId, diagnosis, itemCount: items.length },
      ipAddress
    });

    return prescription;
  }

  static async getPrescriptionById({ tenantId, userId, userRole, prescriptionId }) {
    const prescription = await PrescriptionRepository.findByIdAndTenant(prescriptionId, tenantId);
    if (!prescription) {
      throw new AppError('Prescription not found.', HTTP_STATUS.NOT_FOUND);
    }

    // A doctor may only open prescriptions they themselves wrote. Reported
    // as 404 rather than 403 so a doctor probing other prescription ids
    // can't use the response to tell "exists but not yours" apart from
    // "doesn't exist".
    if (userRole === 'DOCTOR') {
      const doctorProfile = await DoctorRepository.findProfileByUserId(tenantId, userId);
      if (!doctorProfile || prescription.doctor_id !== doctorProfile.doctor_profile_id) {
        throw new AppError('Prescription not found.', HTTP_STATUS.NOT_FOUND);
      }
    }

    return prescription;
  }

  static async updateApproval({ tenantId, userId, prescriptionId, status, ipAddress }) {
    const prescription = await PrescriptionRepository.findByIdAndTenant(prescriptionId, tenantId);
    if (!prescription) {
      throw new AppError('Prescription not found.', HTTP_STATUS.NOT_FOUND);
    }

    const validStatuses = ['pending', 'approved', 'rejected'];
    if (!validStatuses.includes(status)) {
      throw new AppError('Invalid approval status.', HTTP_STATUS.BAD_REQUEST);
    }

    await PrescriptionRepository.updateApprovalStatus(prescriptionId, tenantId, status);

    AuditService.logAction({
      tenantId,
      userId,
      action: `PRESCRIPTION_${status.toUpperCase()}`,
      entityType: 'PRESCRIPTION',
      entityId: prescriptionId,
      oldValue: { approval_status: prescription.approval_status },
      newValue: { approval_status: status },
      ipAddress
    });

    return { prescription_id: prescriptionId, approval_status: status };
  }

  static async listPrescriptions({ tenantId, userId, userRole, query }) {
    const { patientId, page = 1, limit = 50 } = query;
    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    // Doctors only ever see their own prescriptions — the doctorId query
    // param is honored for other roles (admin/pharmacist/nurse) but is
    // ignored, not just defaulted, for a DOCTOR caller so one doctor can't
    // page through another's list by passing a different id.
    let doctorId = query.doctorId;
    if (userRole === 'DOCTOR') {
      const doctorProfile = await DoctorRepository.findProfileByUserId(tenantId, userId);
      if (!doctorProfile) {
        throw new AppError('No doctor profile is associated with this account.', HTTP_STATUS.FORBIDDEN);
      }
      doctorId = doctorProfile.doctor_profile_id;
    }

    const [total, prescriptions] = await PrescriptionRepository.findManyPaginated({
      tenantId, patientId, doctorId, skip, take
    });

    return {
      total,
      page: Number(page),
      pages: Math.ceil(total / limit),
      data: prescriptions
    };
  }
}