import { db } from '../config/db.js';

export class PrescriptionRepository {
  
  static async create({ tenantId, doctorId, patientId, appointmentId, diagnosis, instructions, items }) {
    return db.prescription.create({
      data: {
        tenant_id: tenantId,
        doctor_id: doctorId,
        patient_id: patientId,
        appointment_id: appointmentId || null,
        patient_name_snapshot: '',
        diagnosis: diagnosis,
        approval_status: 'pending',
        notes: instructions,
        medicines: items.map(i => ({
          name: i.medicineName,
          dosage: i.dosage,
          frequency: i.frequency,
          duration: i.durationDays,
          instructions: i.instructions
        })),
        tests: []
      },
      include: {
        patient: { select: { first_name: true, last_name: true, phone: true } },
        doctor_profile: { include: { users: { select: { name: true } } } }
      }
    });
  }

  static async findByIdAndTenant(prescriptionId, tenantId) {
    return db.prescription.findFirst({
      where: { prescription_id: prescriptionId, tenant_id: tenantId, deleted_at: null },
      include: {
        patient: { select: { first_name: true, last_name: true, email: true, phone: true } },
        doctor_profile: { include: { users: { select: { name: true, email: true } } } }
      }
    });
  }

  static async updateApprovalStatus(prescriptionId, tenantId, status) {
    return db.prescription.updateMany({
      where: { prescription_id: prescriptionId, tenant_id: tenantId, deleted_at: null },
      data: { approval_status: status, updated_at: new Date() }
    });
  }

  static async findManyPaginated({ tenantId, patientId, doctorId, skip, take }) {
    const where = { tenant_id: tenantId, deleted_at: null };
    if (patientId) where.patient_id = patientId;
    if (doctorId) where.doctor_id = doctorId;

    return db.$transaction(async (tx) => {
      const [total, prescriptions] = await Promise.all([
        tx.prescription.count({ where }),
        tx.prescription.findMany({
          where,
          skip,
          take,
          orderBy: { created_at: 'desc' },
          include: {
            patient: { select: { first_name: true, last_name: true } },
            doctor_profile: { include: { users: { select: { name: true } } } }
          }
        })
      ]);
      return [total, prescriptions];
    });
  }
}