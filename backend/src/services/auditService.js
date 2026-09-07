// import { db } from "../config/db.js";
// import { logger } from "../config/logger.js";

// export class AuditService {
//   /**
//    * Logs a critical action to the database asynchronously.
//    * @param {Object} params
//    * @param {string} params.tenantId
//    * @param {string} params.userId
//    * @param {string} params.action - e.g., 'CREATE_APPOINTMENT', 'CANCEL_APPOINTMENT'
//    * @param {string} params.entityType - e.g., 'APPOINTMENT'
//    * @param {string} params.entityId
//    * @param {Object} [params.oldValue]
//    * @param {Object} [params.newValue]
//    * @param {string} [params.ipAddress]
//    */
//   static async logAction({
//     tenantId,
//     userId,
//     action,
//     entityType,
//     entityId,
//     oldValue = null,
//     newValue = null,
//     ipAddress = null,
//   }) {
//     try {
//       // We do not await this in the main thread to prevent slowing down the HTTP response.
//       // It runs in the background.
//       db.audit_log
//         .create({
//           data: {
//             // Mapped strictly to the snake_case Prisma schema
//             tenant_id: tenantId,
//             user_id: userId || null,
//             action: action,
//             entity_type: entityType,
//             entity_id: entityId || null,
//             old_value: oldValue ? JSON.parse(JSON.stringify(oldValue)) : null,
//             new_value: newValue ? JSON.parse(JSON.stringify(newValue)) : null,
//             ip_address: ipAddress || null,
//           },
//         })
//         .catch((err) => {
//           logger.error("[AuditService] Failed to save audit log to DB", {
//             error: err.message,
//             action,
//             entityId,
//           });
//         });
//     } catch (error) {
//       logger.error(
//         "[AuditService] Critical failure in audit logging mechanism",
//         { error: error.message },
//       );
//     }
//   }
// }
import { db, tenantStorage } from "../config/db.js";
import { logger } from "../config/logger.js";

export class AuditService {
  static async logAction({
    tenantId,
    userId,
    action,
    entityType,
    entityId,
    oldValue = null,
    newValue = null,
    ipAddress = null,
  }) {
    try {
      // Wrap the background execution in tenantStorage.run to preserve RLS context
      Promise.resolve().then(() => {
        return tenantStorage.run({ tenantId }, () => {
          return db.audit_log.create({
            data: {
              tenant_id: tenantId,
              user_id: userId || null,
              action: action,
              entity_type: entityType,
              entity_id: entityId || null,
              old_value: oldValue ? JSON.parse(JSON.stringify(oldValue)) : null,
              new_value: newValue ? JSON.parse(JSON.stringify(newValue)) : null,
              ip_address: ipAddress || null,
            },
          });
        });
      }).catch((err) => {
        logger.error("[AuditService] Failed to save audit log to DB", {
          error: err.message,
          action,
          entityId,
        });
      });
    } catch (error) {
      logger.error(
        "[AuditService] Critical failure in audit logging mechanism",
        { error: error.message },
      );
    }
  }
}