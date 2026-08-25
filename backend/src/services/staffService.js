import { db } from "../config/db.js";
import { AuditService } from "./auditService.js";
import { AppError } from "../middlewares/errorHandler.js";
import { HTTP_STATUS } from "../constants/httpStatus.js";
import { generateSetupToken } from "../utils/setupToken.js";
import { addNotificationJob } from "../queues/notificationQueue.js";
import { staffWelcomeTemplate } from "../utils/emailTemplates.js";
import { buildPublicFrontendUrl } from "../utils/publicUrl.js";

export class StaffService {
  static async inviteStaff({
    tenantId,
    userId,
    name,
    email,
    roleName,
    ipAddress,
  }) {
    // Prevent inviting roles that have dedicated workflows or global access
    const invalidRoles = ["PATIENT", "DOCTOR", "SYSTEM_OWNER"];
    if (invalidRoles.includes(roleName)) {
      throw new AppError(
        `Cannot provision ${roleName} through this endpoint.`,
        HTTP_STATUS.BAD_REQUEST,
      );
    }

    // Resolve the role safely
    const role = await db.role.findUnique({ where: { name: roleName } });
    if (!role) {
      throw new AppError(
        `System configuration error: Role ${roleName} missing.`,
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
      );
    }

    // Verify uniqueness inside this tenant
    const exists = await db.users.findFirst({
      where: {
        tenant_id: tenantId,
        email: email.toLowerCase(),
        deleted_at: null,
      },
    });
    if (exists) {
      throw new AppError(
        "Email is already in use in this hospital.",
        HTTP_STATUS.CONFLICT,
      );
    }

    // Generate the Setup Token (just like Doctor onboarding)
    const { plainToken, tokenHash, expiresAt } = generateSetupToken();
    console.log("USE THIS PLAIN TOKEN IN POSTMAN:", plainToken);
    // Insert User (RLS applies via tenantStorage in middleware)
    const staff = await db.users.create({
      data: {
        tenant_id: tenantId,
        role_id: role.role_id,
        name: name,
        email: email.toLowerCase(),
        password_hash: null, // Force setup via email
        password_reset_token: tokenHash,
        password_reset_expires: expiresAt,
        must_change_password: true,
      },
    });

    AuditService.logAction({
      tenantId,
      userId,
      action: "PROVISION_STAFF",
      entityType: "USER",
      entityId: staff.user_id,
      newValue: { email, role: roleName },
      ipAddress,
    });

    // Fire and Forget Email
    const tenant = await db.tenant.findUnique({
      where: { tenant_id: tenantId },
    });
    const setupUrl = `${buildPublicFrontendUrl("")}/portal/${tenant?.slug}/setup-password?token=${plainToken}`;
    const emailTpl = staffWelcomeTemplate(staff, roleName, tenant, setupUrl);

    addNotificationJob("email", {
      to: staff.email,
      subject: `Your account has been created - Welcome to ${tenant?.name || "the Hospital"}`,
      html: emailTpl.html,
      extra: { attachments: emailTpl.attachments },
    }).catch((err) =>
      console.error("[StaffService] Failed to queue account-setup email", err),
    );

    return staff;
  }
}
