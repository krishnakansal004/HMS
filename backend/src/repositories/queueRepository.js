import { db } from '../config/db.js';
import { AppError } from '../middlewares/errorHandler.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';

export class QueueRepository {
  static async generateTokenTransaction({ tenantId, doctorId, patientId, patientName, tokenDate }) {
    return db.$transaction(async (tx) => {
      // Serialize requests for this specific doctor on this specific date
      // This mathematically guarantees no two receptionists can race for the same token number
      const lockString = `token_${doctorId}_${tokenDate}`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockString}))`;

      // Calculate the next available token number safely inside the lock
      const maxTokenResult = await tx.queue_token.aggregate({
        where: { 
          doctor_id: doctorId, 
          token_date: new Date(tokenDate) 
        },
        _max: { token_number: true }
      });
      
      const nextTokenNumber = (maxTokenResult._max.token_number || 0) + 1;

      // 3. Insert the token. Guaranteed to be unique and strictly sequential.
      const token = await tx.queue_token.create({
        data: {
          tenant_id: tenantId,
          doctor_id: doctorId,
          patient_id: patientId || null,
          patient_name: patientName,
          token_number: nextTokenNumber,
          token_date: new Date(tokenDate),
          status: 'WAITING'
        }
      });

      return token;
    });
  }
}