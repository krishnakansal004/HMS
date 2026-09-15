import { db } from "../config/db.js";

export class VoiceNoteRepository {
  static async create({
    tenantId,
    patientId,
    recordedBy,
    storageUrl,
    publicId,
    mimeType,
    sizeBytes,
    durationSeconds,
    visibleToRoles,
  }) {
    return db.voice_note.create({
      data: {
        tenant_id: tenantId,
        patient_id: patientId,
        recorded_by: recordedBy,
        storage_url: storageUrl,
        public_id: publicId || null,
        mime_type: mimeType,
        size_bytes: sizeBytes,
        duration_seconds: durationSeconds || null,
        visible_to_roles: visibleToRoles,
      },
    });
  }

  static async findVisible({ tenantId, patientId, role }) {
    return db.voice_note.findMany({
      where: {
        tenant_id: tenantId,
        ...(patientId ? { patient_id: patientId } : {}),
        ...(role ? { visible_to_roles: { has: role } } : {}),
      },
      orderBy: { created_at: "desc" },
    });
  }

  static async findByIdAndTenant(voiceNoteId, tenantId) {
    return db.voice_note.findFirst({
      where: { voice_note_id: voiceNoteId, tenant_id: tenantId },
    });
  }

  static async deleteByIdAndTenant(voiceNoteId, tenantId) {
    return db.voice_note.deleteMany({
      where: { voice_note_id: voiceNoteId, tenant_id: tenantId },
    });
  }
}
