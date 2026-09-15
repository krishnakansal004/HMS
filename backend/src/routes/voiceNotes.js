import express from "express";
import multer from "multer";
import { protect, requireRoles } from "../middlewares/authMiddleware.js";
import { requireTenant } from "../middlewares/tenantMiddleware.js";
import { VoiceNoteController } from "../controllers/voiceNoteController.js";
import {
  listVoiceNotesValidator,
  voiceNoteIdValidator,
} from "../validators/voiceNoteValidator.js";

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    if (file.mimetype.startsWith("audio/")) return callback(null, true);
    callback(new Error("Only audio recordings are supported."));
  },
});

router.use(protect);
router.use(requireTenant);

router.post(
  "/",
  requireRoles("PATIENT"),
  upload.single("audio"),
  VoiceNoteController.create,
);

router.get(
  "/",
  requireRoles("PATIENT", "DOCTOR", "NURSE", "HOSPITAL_ADMIN"),
  listVoiceNotesValidator,
  VoiceNoteController.list,
);

router.delete(
  "/:id",
  requireRoles("HOSPITAL_ADMIN"),
  voiceNoteIdValidator,
  VoiceNoteController.remove,
);

export default router;
