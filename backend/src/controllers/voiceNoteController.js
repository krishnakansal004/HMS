import { HTTP_STATUS } from "../constants/httpStatus.js";
import { VoiceNoteService } from "../services/voiceNoteService.js";

export class VoiceNoteController {
  static async create(req, res, next) {
    try {
      const voiceNote = await VoiceNoteService.create({
        tenantId: req.currentTenantId,
        userId: req.userId,
        file: req.file,
        durationSeconds: req.body.durationSeconds,
        ipAddress: req.ip,
      });
      res.status(HTTP_STATUS.CREATED).json({ success: true, data: voiceNote });
    } catch (error) {
      next(error);
    }
  }

  static async list(req, res, next) {
    try {
      const voiceNotes = await VoiceNoteService.list({
        tenantId: req.currentTenantId,
        userId: req.userId,
        userRole: req.userRole,
        patientId: req.query.patientId,
      });
      res.status(HTTP_STATUS.OK).json({ success: true, data: voiceNotes });
    } catch (error) {
      next(error);
    }
  }

  static async remove(req, res, next) {
    try {
      await VoiceNoteService.remove({
        tenantId: req.currentTenantId,
        userId: req.userId,
        voiceNoteId: req.params.id,
        ipAddress: req.ip,
      });
      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: "Voice note deleted.",
      });
    } catch (error) {
      next(error);
    }
  }
}
