import { request } from "./client.js";

export const voiceNotesApi = {
  list: (query) => request("/voice-notes", { method: "GET", query }),
  remove: (id) => request(`/voice-notes/${id}`, { method: "DELETE" }),
  create: (audioBlob, durationSeconds) => {
    const body = new FormData();
    body.append("audio", audioBlob, `patient-voice-note-${Date.now()}.webm`);
    body.append("durationSeconds", String(Math.max(1, Math.round(durationSeconds || 1))));
    return request("/voice-notes", { method: "POST", body, isForm: true });
  },
};
