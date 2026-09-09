import { prisma } from './db.js';
import { AppError } from '../middlewares/errorHandler.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';

// Only export this wrapper, NEVER the raw client
export const executeAsSystemOwner = async (userRole, operation) => {
  if (userRole !== 'SYSTEM_OWNER') {
    throw new AppError('Forbidden: System Owner privilege required.', HTTP_STATUS.FORBIDDEN);
  }
  return operation(prisma);
};