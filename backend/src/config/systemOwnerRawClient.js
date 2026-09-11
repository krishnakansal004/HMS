import { prisma } from './db.js';
import { AppError } from '../middlewares/errorHandler.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';

export async function queryAcrossTenants(requestingUserRole, callback) {
  if (requestingUserRole !== 'SYSTEM_OWNER') {
    throw new AppError('Restricted to System Owner.', HTTP_STATUS.FORBIDDEN);
  }
  // Execute using the raw client, bypassing the tenantStorage proxy
  return callback(prisma);
}