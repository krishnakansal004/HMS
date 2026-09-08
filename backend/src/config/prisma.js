import { PrismaClient } from '@prisma/client';
import { AppError } from '../middlewares/errorHandler.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';

const rawPrisma = new PrismaClient();

// Only export this wrapper, NEVER the raw client
export const executeAsSystemOwner = async (userRole, operation) => {
  if (userRole !== 'SYSTEM_OWNER') {
    throw new AppError('Forbidden: System Owner privilege required.', HTTP_STATUS.FORBIDDEN);
  }
  return operation(rawPrisma);
};