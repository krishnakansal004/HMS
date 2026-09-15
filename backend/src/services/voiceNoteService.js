import { db } from "../config/db.js";
import { deleteFromCloudinary, uploadToCloudinary } from "../config/cloudinary.js";
import { AppError } from "../middlewares/errorHandler.js";
import { HTTP_STATUS } from "../constants/httpStatus.js";
import { AuditService } from "./auditService.js";
import { VoiceNoteRepository } from "../repositories/voiceNoteRepository.js";

const VISIBLE_TO_ROLES = ["DOCTOR", "NURSE", "HOSPITAL_ADMIN"];

export class VoiceNoteService {
  static async create({ tenantId, userId, file, durationSeconds, ipAddress }) {
    if (!file) {
      throw new AppError("An audio recording is required.", HTTP_STATUS.BAD_REQUEST);
    }
    const duration = Number(durationSeconds);
    if (!Number.isFinite(duration) || duration < 1 || duration > 600) {
      throw new AppError("Voice note duration must be between 1 and 600 seconds.", HTTP_STATUS.BAD_REQUEST);
    }

    const patient = await db.patient.findFirst({
      where: { tenant_id: tenantId, user_id: userId, deleted_at: null },
      select: { patient_id: true },
    });
    if (!patient) {
      throw new AppError("Patient record not found.", HTTP_STATUS.NOT_FOUND);
    }

    const uploaded = await uploadToCloudinary(
      file.buffer,
      `tenants/${tenantId}/patient-voice-notes`,
      "video",
    );
    const voiceNote = await VoiceNoteRepository.create({
      tenantId,
      patientId: patient.patient_id,
      recordedBy: userId,
      storageUrl: uploaded.secure_url,
      publicId: uploaded.public_id,
      mimeType: file.mimetype,
      sizeBytes: file.size,
      durationSeconds: Math.round(duration),
      visibleToRoles: VISIBLE_TO_ROLES,
    });

    AuditService.logAction({
      tenantId,
      userId,
      action: "CREATE_PATIENT_VOICE_NOTE",
      entityType: "VOICE_NOTE",
      entityId: voiceNote.voice_note_id,
      newValue: { patientId: patient.patient_id, mimeType: file.mimetype },
      ipAddress,
    });
    return voiceNote;
  }

  static async list({ tenantId, userId, userRole, patientId }) {
    let targetPatientId = patientId || null;
    if (userRole === "PATIENT") {
      const patient = await db.patient.findFirst({
        where: { tenant_id: tenantId, user_id: userId, deleted_at: null },
        select: { patient_id: true },
      });
      if (!patient) throw new AppError("Patient record not found.", HTTP_STATUS.NOT_FOUND);
      targetPatientId = patient.patient_id;
    }

    return VoiceNoteRepository.findVisible({
      tenantId,
      patientId: targetPatientId,
      // Patients may replay only their own notes; staff must match the
      // explicit role allowlist stored on each note.
      role: userRole === "PATIENT" ? null : userRole,
    });
  }

  static async remove({ tenantId, userId, voiceNoteId, ipAddress }) {
    const voiceNote = await VoiceNoteRepository.findByIdAndTenant(
      voiceNoteId,
      tenantId,
    );
    if (!voiceNote) {
      throw new AppError("Voice note not found.", HTTP_STATUS.NOT_FOUND);
    }

    await deleteFromCloudinary(voiceNote.public_id, "video");
    await VoiceNoteRepository.deleteByIdAndTenant(voiceNoteId, tenantId);

    AuditService.logAction({
      tenantId,
      userId,
      action: "DELETE_PATIENT_VOICE_NOTE",
      entityType: "VOICE_NOTE",
      entityId: voiceNoteId,
      oldValue: { patientId: voiceNote.patient_id, publicId: voiceNote.public_id },
      ipAddress,
    });
    return { success: true };
  }
}
