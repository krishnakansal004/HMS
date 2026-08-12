import { db } from '../config/db.js';
import { logger } from '../config/logger.js';

export class AuditService {
  /**
   * Logs a critical action to the database asynchronously.
   * @param {Object} params
   * @param {string} params.tenantId
   * @param {string} params.userId
   * @param {string} params.action - e.g., 'CREATE_APPOINTMENT', 'CANCEL_APPOINTMENT'
   * @param {string} params.entityType - e.g., 'APPOINTMENT'
   * @param {string} params.entityId
   * @param {Object} [params.oldValue]
   * @param {Object} [params.newValue]
   * @param {string} [params.ipAddress]
   */
  static async logAction({ tenantId, userId, action, entityType, entityId, oldValue = null, newValue = null, ipAddress = null }) {
    try {
      // We do not await this in the main thread to prevent slowing down the HTTP response.
      // It runs in the background.
      db.auditLog.create({
        data: {
          tenantId,
          userId,
          action,
          entityType,
          entityId,
          oldValue,
          newValue,
          ipAddress
        }
      }).catch((err) => {
        logger.error('[AuditService] Failed to save audit log to DB', { error: err.message, action, entityId });
      });
    } catch (error) {
      logger.error('[AuditService] Critical failure in audit logging mechanism', { error: error.message });
    }
  }
}