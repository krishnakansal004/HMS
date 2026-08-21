import express from 'express'
import multer from 'multer'
import jwt from 'jsonwebtoken'
import ChatModel from '../models/ChatModel.js'

let OpenAIClient = null
try {
  const mod = await import('openai')
  OpenAIClient = mod.default
} catch {
  // openai not installed yet; we will fallback to echo mode
}

const router = express.Router()

// Standard fallback message for unknown/unanswerable queries
const STANDARD_FALLBACK = `Hello,
I’m unable to assist with this query. Please visit the Query section on the website and submit your concern directly to the admin.
Thank you.`;

// Memory storage for small uploads (voice/image snippets)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 4,
  },
})

function optionalAuth(req, _res, next) {
  const auth = req.headers.authorization || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  req.userRole = 'general'
  if (!token) return next()
  try {
    const accessSecret = process.env.ACCESS_TOKEN_SECRET
    if (!accessSecret) throw new Error('ACCESS_TOKEN_SECRET is not configured')
    const payload = jwt.verify(token, accessSecret)
    // In this optional check we don't enforce sessionId match here; best-effort role derivation will be done in DB-backed middleware in other routes.
    // However, for privacy, do not fetch DB here; allow the client to also send a hint role in body.
    if (payload.role) req.userRole = payload.role
  } catch { }
  next()
}

function roleSystemPrompt(role = 'general') {
  const base = `You are an assistant for a Hospital Management System (HMS). Answer clearly and accurately. If asked about step-by-step actions in the app, explain using concise steps referencing common labels like Dashboard, Appointments, Billing, Inventory, etc. If the question requires private data, say you cannot access personal records here and guide where to find it in the app.`
  const map = {
    admin: `You are assisting an administrator. Prioritize help with: approving doctor applications, managing inventory and low-stock alerts, generating billing and sales reports, creating/editing departments, wards, and staff roles, setting user permissions. Avoid exposing confidential data. Provide practical, actionable steps within the HMS UI.`,
    doctor: `You are assisting a doctor. Prioritize help with: viewing today's appointments, managing availability/leave, accessing patient records you are permitted to view, creating e‑prescriptions, and checking queue tokens. Emphasize clinical workflows and compliance. Do not provide medical diagnosis beyond general guidance.`,
    patient: `You are assisting a patient. Prioritize help with: booking appointments, viewing prescriptions and reports, downloading invoices, resetting passwords, and uploading medical reports. Provide friendly guidance and next steps. Avoid medical advice—encourage consulting a professional.`,
    general: `Provide general HMS guidance: what the system does, finding doctors, clinic hours, contacting support, and queue status basics.`,
  }
  return `${base}\n\nRole context: ${map[role] || map.general}`
}

async function callOpenAI({ message, images = [], audio, system, temperature = 0.2 }) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!OpenAIClient || !apiKey) {
    return STANDARD_FALLBACK
  }
  const openai = new OpenAIClient({ apiKey })

  // If there are images, use vision-capable content parts
  const hasImages = images.length > 0
  const contentParts = []
  if (message) contentParts.push({ type: 'text', text: message })
  for (const img of images) {
    const mime = img.mimetype || 'image/png'
    const b64 = img.buffer.toString('base64')
    contentParts.push({ type: 'image_url', image_url: { url: `data:${mime};base64,${b64}` } })
  }

  // If audio was provided, try transcribing first and append text
  if (audio) {
    try {
      const transcription = await openai.audio.transcriptions.create({
        file: new Blob([audio.buffer], { type: audio.mimetype || 'audio/webm' }),
        model: 'whisper-1',
      })
      const text = transcription?.text || ''
      if (text) contentParts.push({ type: 'text', text: `Transcribed audio: ${text}` })
    } catch (e) {
      // Non-fatal: continue without transcription
      contentParts.push({ type: 'text', text: '(Note: audio transcription unavailable)\n' })
    }
  }

  // Use a small, cost-effective model; switch to gpt-4o-mini for images
  const model = hasImages ? 'gpt-4o-mini' : 'gpt-4o-mini'

  const resp = await openai.chat.completions.create({
    model,
    temperature,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: hasImages || audio ? contentParts : message },
    ],
  })
  const reply = resp.choices?.[0]?.message?.content?.trim() || 'Sorry, I have no answer right now.'
  return reply
}

router.post('/', optionalAuth, upload.fields([
  { name: 'images', maxCount: 3 },
  { name: 'audio', maxCount: 1 },
]), async (req, res) => {
  try {
    const isMultipart = req.is('multipart/form-data')
    const body = isMultipart ? req.body : req.body || {}

    // Input
    const { system, temperature, notes, message, role: roleHint, stream } = body
    const role = (roleHint || req.userRole || 'general').toLowerCase()

    // Files
    const files = req.files || {}
    let images = (files.images || []).slice(0, 3)
    const audio = (files.audio && files.audio[0]) || null

    // Support clients that send a single file as base64 in JSON (modal/file uploads from frontend iframe)
    // Expect body.fileBase64 and body.mimeType when provided.
    if (!images.length && body.fileBase64) {
      try {
        const mime = body.mimeType || 'application/octet-stream'
        images = [{ mimetype: mime, buffer: Buffer.from(body.fileBase64, 'base64') }]
      } catch (e) {
        console.warn('chat:failed-to-decode-base64-file', e?.message || e)
      }
    }

    // Quick greeting detection (simple): if user says hello/hi/hey, return canned greeting
    const textMessage = String(message || '').trim()
    const low = textMessage.toLowerCase()
    const greetingPattern = /^(hi|hello|hey|good morning|good afternoon|good evening)[\.!\s]*$/i
    if (greetingPattern.test(textMessage)) {
      return res.json({ reply: 'Hello, How can I help you?', role })
    }

    // System prompt and model lookup
    let sys = [roleSystemPrompt(role), notes ? `Additional context: ${notes}` : ''].filter(Boolean).join('\n\n')
    try {
      const modelDoc = await ChatModel.findOne({ role })
      if (modelDoc) {
        if (modelDoc.systemPrompt) sys = [roleSystemPrompt(role), modelDoc.systemPrompt, notes ? `Additional context: ${notes}` : ''].filter(Boolean).join('\n\n')
        // Keyword matching: check keywords for substring match (case-insensitive)
        if (textMessage && Array.isArray(modelDoc.keywords) && modelDoc.keywords.length) {
          const text = textMessage.toLowerCase()
          for (const k of modelDoc.keywords) {
            try {
              if (!k || !k.keyword) continue
              const kw = k.keyword.toString().toLowerCase()
              if (kw && text.includes(kw)) {
                // Return canned answer directly without calling OpenAI
                return res.json({ reply: k.answer || STANDARD_FALLBACK, role })
              }
            } catch (e) { continue }
          }
        }
        // If model exists and no keyword matched, return model-specific fallback if provided,
        // otherwise use a default fallback asking to contact admin
        const fallback = modelDoc.fallbackMessage || STANDARD_FALLBACK
        return res.json({ reply: fallback, role })
      }
    } catch (e) {
      console.warn('chat:model-lookup', e?.message || e)
    }

    const temp = typeof temperature === 'string' ? parseFloat(temperature) : (temperature ?? 0.2)
    const wantStream = stream === '1' || stream === 1 || stream === true

    if (wantStream && OpenAIClient && process.env.OPENAI_API_KEY) {
      try {
        const apiKey = process.env.OPENAI_API_KEY
        const openai = new OpenAIClient({ apiKey })
        const hasImages = images.length > 0
        const contentParts = []
        if (message) contentParts.push({ type: 'text', text: message })
        for (const img of images) {
          const mime = img.mimetype || 'image/png'
          const b64 = img.buffer.toString('base64')
          contentParts.push({ type: 'image_url', image_url: { url: `data:${mime};base64,${b64}` } })
        }
        if (audio) {
          try {
            const transcription = await openai.audio.transcriptions.create({
              file: new Blob([audio.buffer], { type: audio.mimetype || 'audio/webm' }),
              model: 'whisper-1',
            })
            const text = transcription?.text || ''
            if (text) contentParts.push({ type: 'text', text: `Transcribed audio: ${text}` })
          } catch { }
        }

        const model = hasImages ? 'gpt-4o-mini' : 'gpt-4o-mini'

        res.setHeader('Content-Type', 'text/plain; charset=utf-8')
        res.setHeader('Cache-Control', 'no-cache')
        res.setHeader('X-Accel-Buffering', 'no')
        if (res.flushHeaders) res.flushHeaders()

        const streamResp = await openai.chat.completions.create({
          model,
          temperature: temp,
          stream: true,
          messages: [
            { role: 'system', content: system || sys },
            { role: 'user', content: (hasImages || audio) ? contentParts : (message || '') },
          ],
        })
        let hadAny = false
        for await (const part of streamResp) {
          const delta = part.choices?.[0]?.delta?.content || ''
          if (delta) { hadAny = true; res.write(delta) }
        }
        if (!hadAny) res.write('')
        return res.end()
      } catch (e) {
        console.warn('streaming fallback', e?.message || e)
        // fall through to non-streaming
      }
    }

    // Non-streaming generate
    const reply = await callOpenAI({ message, images, audio, system: system || sys, temperature: temp })
    return res.json({ reply, role })
  } catch (e) {
    console.error('chat error', e)
    return res.status(500).json({ error: 'Chat service error' })
  }
})

export default router
