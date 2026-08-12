import { db } from '../config/db.js';

export class AttendanceRepository {
  
  static async findByUserAndDate(tenantId, userId, date) {
    return db.attendance.findUnique({
      // Prisma requires the exact unique compound key for findUnique
      where: {
        userId_date: {
          userId: userId,
          date: date
        },
        tenantId: tenantId
      }
    });
  }

  static async findByIdAndTenant(id, tenantId) {
    return db.attendance.findFirst({
      where: { id, tenantId }
    });
  }

  static async create(data) {
    return db.attendance.create({
      data,
      include: {
        user: { select: { firstName: true, lastName: true, email: true } }
      }
    });
  }

  static async update(id, data) {
    return db.attendance.update({
      where: { id },
      data,
      include: {
        user: { select: { firstName: true, lastName: true, email: true } }
      }
    });
  }

  static async findManyPaginated({ tenantId, userId, startDate, endDate, status, skip, take }) {
    const where = { tenantId };

    if (userId) where.userId = userId;
    if (status) where.status = status;
    
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate) where.date.lte = new Date(endDate);
    }

    return db.$transaction([
      db.attendance.count({ where }),
      db.attendance.findMany({
        where,
        skip,
        take,
        orderBy: [{ date: 'desc' }, { checkIn: 'desc' }],
        include: {
          user: { select: { firstName: true, lastName: true, email: true } }
        }
      })
    ]);
  }
}