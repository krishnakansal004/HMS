import { db } from '../config/db.js';
import { AppError } from '../middlewares/errorHandler.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';

export class PatientRepository {
  
  static async create(tenantId, data) {

    return db.patient.create({
      data: {
        tenant_id: tenantId,
        ...data
      }
    });
  }

  static async findByIdAndTenant(patientId, tenantId) {
    // IDOR Protection: Always requires matching tenant_id and deleted_at: null
    return db.patient.findFirst({
      where: { 
        patient_id: patientId, 
        tenant_id: tenantId,
        deleted_at: null
      },
      include: {
        appointment: {
          where: { deleted_at: null },
          orderBy: { slot_start: 'desc' },
          take: 5,
          include: { 
            doctor_profile: { 
              include: { users: { select: { name: true } } } 
            } 
          }
        },
        prescription: {
          where: { deleted_at: null },
          orderBy: { created_at: 'desc' },
          take: 5
        },
        invoice: {
          where: { deleted_at: null },
          orderBy: { created_at: 'desc' },
          take: 5
        }
      }
    });
  }

  static async findByEmailOrPhone(tenantId, email, phone) {
    const conditions = [];
    if (email) conditions.push({ email });
    if (phone) conditions.push({ phone });
    if (conditions.length === 0) return null;

    // Scoped strictly to the tenant and non-deleted records
    return db.patient.findFirst({
      where: {
        tenant_id: tenantId,
        deleted_at: null,
        OR: conditions
      }
    });
  }

  static async update(patientId, tenantId, data) {
    // updateMany combined with tenant_id guarantees zero cross-tenant updates (BOLA defense)
    const result = await db.patient.updateMany({
      where: { 
        patient_id: patientId, 
        tenant_id: tenantId,
        deleted_at: null
      },
      data: { ...data, updated_at: new Date() }
    });

    if (result.count === 0) {
      throw new AppError('Patient record not found or unauthorized.', HTTP_STATUS.NOT_FOUND);
    }

    return this.findByIdAndTenant(patientId, tenantId);
  }

  static async findManyPaginated({ tenantId, search, skip, take, doctorProfileId }) {
    const where = { tenant_id: tenantId, deleted_at: null };
    
    if (search) {
      where.OR = [
        { first_name: { contains: search, mode: 'insensitive' } },
        { last_name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } }
      ];
    }

   if (doctorProfileId) {
      where.AND = [
        {
          OR: [
            { appointment: { some: { doctor_id: doctorProfileId, deleted_at: null } } },
            { admission: { some: { admitting_doctor_id: doctorProfileId, deleted_at: null } } },
            { prescription: { some: { doctor_id: doctorProfileId, deleted_at: null } } }
          ]
        }
      ];
    }

    return db.$transaction(async (tx) => {
      const [total, patients] = await Promise.all([
        tx.patient.count({ where }),
        tx.patient.findMany({
          where,
          skip,
          take,
          orderBy: { created_at: 'desc' }
        })
      ]);
      return [total, patients];
    });
  }
}