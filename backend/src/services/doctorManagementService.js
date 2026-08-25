import { DoctorManagementRepository } from "../repositories/doctorManagementRepository.js";
import { AuditService } from "./auditService.js";
import { AppError } from "../middlewares/errorHandler.js";
import { HTTP_STATUS } from "../constants/httpStatus.js";
import { addNotificationJob } from "../queues/notificationQueue.js";
import {
  doctorApprovalTemplate,
  doctorApplicationReceivedTemplate,
} from "../utils/emailTemplates.js";
import { buildPublicFrontendUrl } from "../utils/publicUrl.js";
import { generateSetupToken } from "../utils/setupToken.js";
import { db } from "../config/db.js";

export class DoctorManagementService {
  static async submitApplication(data) {
    try {
      const tenant = await db.tenant.findUnique({
        where: { slug: data.hospitalSlug },
      });

      if (!tenant || tenant.status !== "active") {
        throw new AppError(
          "Hospital not found or is currently inactive.",
          HTTP_STATUS.NOT_FOUND,
        );
      }

      // The Belt: Fast application-layer check
      const existingPending =
        await DoctorManagementRepository.checkPendingApplication(
          tenant.tenant_id,
          data.email,
        );

      if (existingPending) {
        throw new AppError(
          "You already have a pending application for this hospital.",
          HTTP_STATUS.CONFLICT,
        );
      }

      // Insert the application
      const app = await DoctorManagementRepository.createPublicApplication(
        tenant.tenant_id,
        data,
      );

      // Queue the email
      const emailTpl = doctorApplicationReceivedTemplate(data);
      addNotificationJob("email", {
        to: app.email,
        subject: "Application Received",
        html: emailTpl.html,
        extra: { attachments: emailTpl.attachments },
      }).catch((err) =>
        console.error("[DoctorMgmt] Failed to queue app receipt email", err),
      );

      return app;
    } catch (error) {
      // The Suspenders: DB-layer race-condition backstop
      if (error.code === "P2002") {
        throw new AppError(
          "You already have a pending application for this hospital.",
          HTTP_STATUS.CONFLICT,
        );
      }
      throw error;
    }
  }

  static async reviewApplication({
    tenantId,
    userId,
    applicationId,
    status,
    ipAddress,
  }) {
    const application =
      await DoctorManagementRepository.findApplicationByIdAndTenant(
        applicationId,
        tenantId,
      );

    if (!application) {
      throw new AppError("Application not found.", HTTP_STATUS.NOT_FOUND);
    }
    if (application.status !== "PENDING") {
      throw new AppError(
        `Cannot review an application that is already ${application.status}.`,
        HTTP_STATUS.BAD_REQUEST,
      );
    }

    if (status === "REJECTED") {
      const rejected = await DoctorManagementRepository.rejectApplication(
        tenantId,
        userId,
        applicationId,
      );
      AuditService.logAction({
        tenantId,
        userId,
        action: "REJECT_DOCTOR_APPLICATION",
        entityType: "DOCTOR_APPLICATION",
        entityId: applicationId,
        newValue: { status: "REJECTED" },
        ipAddress,
      });
      return rejected;
    }

    if (status === "APPROVED") {
      const { plainToken, tokenHash, expiresAt } = generateSetupToken();

      try {
        const { user, updatedApp } =
          await DoctorManagementRepository.approveApplicationTransaction({
            tenantId,
            reviewerId: userId,
            applicationId,
            application,
            passwordResetTokenHash: tokenHash,
            passwordResetExpires: expiresAt,
          });

        AuditService.logAction({
          tenantId,
          userId,
          action: "APPROVE_DOCTOR_APPLICATION",
          entityType: "DOCTOR_APPLICATION",
          entityId: applicationId,
          newValue: { status: "APPROVED", newUserId: user.user_id },
          ipAddress,
        });

        const tenant = await db.tenant.findUnique({
          where: { tenant_id: tenantId },
        });
        const setupUrl = `${buildPublicFrontendUrl("")}/portal/${tenant?.slug}/setup-password?token=${plainToken}`;

        const emailTpl = doctorApprovalTemplate(
          {
            name: application.name,
            email: application.email,
            specialization: application.specialization,
            department: application.department,
            yearsExperience: application.years_experience,
            education: application.education,
          },
          { setupUrl },
          tenant,
        );

        addNotificationJob("email", {
          to: user.email,
          subject: `Application Approved - Welcome to ${tenant?.name || "the Hospital"}`,
          html: emailTpl.html,
          extra: { attachments: emailTpl.attachments },
        }).catch((err) =>
          console.error("[DoctorMgmt] Failed to queue approval email", err),
        );

        return updatedApp;
      } catch (error) {
        if (error.message === "ROLE_NOT_FOUND") {
          throw new AppError(
            "System configuration error: DOCTOR role missing.",
            HTTP_STATUS.INTERNAL_SERVER_ERROR,
          );
        }
        throw error;
      }
    }

    throw new AppError("Invalid review status.", HTTP_STATUS.BAD_REQUEST);
  }

  static async listApplications({ tenantId, query }) {
    const { status, page = 1, limit = 50 } = query;
    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);
    const [total, data] = await DoctorManagementRepository.findManyPaginated({
      tenantId,
      status,
      skip,
      take,
    });
    return { total, page: Number(page), pages: Math.ceil(total / take), data };
  }
}
