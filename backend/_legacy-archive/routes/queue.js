import express from 'express';
import QueueToken from '../models/QueueToken.js';
import DoctorProfile from '../models/DoctorProfile.js'
import { protect, doctor, admin } from '../utils/auth.js';
import { istDateString } from '../utils/ist.js';

// Helper to attach position for waiting tokens (1-based)
function attachPositions(list) {
  // assume list sorted by number asc
  let pos = 0
  return list.map(t => {
    const copy = t.toObject ? t.toObject() : { ...t }
    if (copy.status === 'waiting') {
      pos += 1
      copy.position = pos
    } else {
      copy.position = null
    }
    return copy
  })
}

const router = express.Router();

// Get queue for doctor/date
router.get('/', protect, async (req, res) => {
  const { doctorId, date } = req.query;
  if (!doctorId || !date) return res.status(400).json({ error: 'doctorId and date required' });
  // If doctor is inactive, return empty list
  try {
    const prof = await req.db(DoctorProfile).findOne({ user: doctorId })
    if (!prof || prof.active === false) return res.json([])
  } catch (e) { /* ignore and continue */ }
  // populate patient basic info so doctor can see contact and inpatient status
  const list = await req.db(QueueToken).find({ doctor: doctorId, date }).sort({ number: 1 }).populate({ path: 'patient', select: 'firstName lastName phone email inpatient avatarUrl' }).populate({ path: 'doctor', select: 'name' });
  // attach positions for waiting tokens
  const withPos = attachPositions(list)
  res.json(withPos);
});

// Issue next token
router.post('/', protect, async (req, res) => {
  const { doctorId, date, patientName, patient } = req.body;
  if (!doctorId || !date || !patientName) return res.status(400).json({ error: 'doctorId, date, patientName required' });
  // prevent issuing tokens for inactive/deleted doctors
  try {
    const prof = await req.db(DoctorProfile).findOne({ user: doctorId })
    if (!prof || prof.active === false) return res.status(400).json({ error: 'Doctor not available' })
  } catch (e) { /* ignore */ }
  const last = await req.db(QueueToken).findOne({ doctor: doctorId, date }).sort({ number: -1 });
  const nextNumber = last ? last.number + 1 : 1;
  // allow caller to specify source (doctor-issued, appointment, etc.)
  const source = req.body.source || 'doctor-issued'
  const token = await req.db(QueueToken).create({ doctor: doctorId, date, number: nextNumber, patientName, patient, source });
  res.status(201).json(token);
});

// Update status
router.patch('/:id', protect, async (req, res) => {
  const token = await req.db(QueueToken).findById(req.params.id);
  if (!token) return res.status(404).json({ error: 'Token not found' });
  // If doctor attempts to call a token but requires payment, mark paymentRequired and don't set status to 'called' yet
  if (req.body.status === 'called' && req.body.paymentRequired) {
    token.paymentRequired = true
    token.paymentStatus = 'pending'
    if (req.body.meetingLink !== undefined) token.meetingLink = req.body.meetingLink
  } else {
    if (req.body.status) token.status = req.body.status;
    // allow setting meetingLink when updating token (e.g., doctor provides link)
    if (req.body.meetingLink !== undefined) token.meetingLink = req.body.meetingLink
    // allow updating payment flags
    if (req.body.paymentRequired !== undefined) token.paymentRequired = req.body.paymentRequired
    if (req.body.paymentStatus) token.paymentStatus = req.body.paymentStatus
    if (req.body.paymentInfo !== undefined) token.paymentInfo = req.body.paymentInfo
  }
  await token.save();
  res.json(token);
});

// Call next (helper)
router.post('/call-next', protect, async (req, res) => {
  const { doctorId, date } = req.body;
  const next = await req.db(QueueToken).findOne({ doctor: doctorId, date, status: 'waiting' }).sort({ number: 1 });
  if (!next) return res.status(404).json({ error: 'No waiting tokens' });
  // optional meetingLink passed by doctor when calling next
  const { meetingLink, paymentRequired } = req.body || {}
  // If payment is required, mark token as requiring payment but do NOT advance to 'called' yet
  if (paymentRequired) {
    next.paymentRequired = true
    next.paymentStatus = 'pending'
    if (meetingLink) next.meetingLink = meetingLink
  } else {
    // normal flow: call the token immediately
    next.status = 'called';
    if (meetingLink) next.meetingLink = meetingLink
  }
  await next.save();
  const populated = await req.db(QueueToken).findById(next._id).populate({ path: 'patient', select: 'firstName lastName phone email inpatient avatarUrl' }).populate({ path: 'doctor', select: 'name' })
  res.json(populated);
});

// Patient pays for a token (simplified endpoint to mark payment completed)
router.post('/:id/pay', protect, async (req, res) => {
  try {
    const token = await req.db(QueueToken).findById(req.params.id)
    if (!token) return res.status(404).json({ error: 'Token not found' })
    // ensure current user is the token patient
    const patientModel = (await import('../models/Patient.js')).default
    const patient = await patientModel.findOne({ email: req.user.email })
    if (!patient || String(patient._id) !== String(token.patient)) return res.status(403).json({ error: 'Not allowed' })
    if (!token.paymentRequired) return res.status(400).json({ error: 'Payment not required for this token' })
    // accept optional payment details
    token.paymentStatus = 'paid'
    token.paymentInfo = req.body.paymentInfo || { method: 'manual' }
    // push a system message into token chat so doctor sees payment happened
    token.messages = token.messages || []
    try {
      const parts = []
      if (token.paymentInfo && token.paymentInfo.method) parts.push(`Method: ${token.paymentInfo.method}`)
      if (token.paymentInfo && token.paymentInfo.razorpay && token.paymentInfo.razorpay.id) parts.push(`Razorpay: ${token.paymentInfo.razorpay.id}`)
      if (req.body.invoiceId) parts.push(`Invoice: ${req.body.invoiceId}`)
      const msgText = parts.length ? `Payment received (${parts.join(', ')})` : 'Payment received.'
      token.messages.push({ sender: 'system', text: msgText, createdAt: new Date() })
    } catch (err) {
      // non-fatal if message push fails
      console.error('Failed to append payment message to token:', err)
    }
    // if payment completed and doctor had set a meetingLink, advance to called so patient can join
    if (token.paymentRequired && token.paymentStatus === 'paid') {
      token.status = 'called'
    }
    await token.save()
    const populated = await req.db(QueueToken).findById(token._id).populate({ path: 'patient', select: 'firstName lastName phone email inpatient avatarUrl' }).populate({ path: 'doctor', select: 'name' })
    res.json(populated)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Server error' })
  }
})

// Get current user's tokens for today (patient-facing)
router.get('/my', protect, async (req, res) => {
  const { date, doctorId } = req.query
  // find patient record linked by user email
  const patient = await (await import('../models/Patient.js')).default.findOne({ email: req.user.email })
  if (!patient) return res.json([])
  const q = { patient: patient._id }
  if (date) q.date = date
  if (doctorId) q.doctor = doctorId
  const list = await req.db(QueueToken).find(q).sort({ number: 1 }).populate({ path: 'doctor', select: 'name' }).populate({ path: 'patient', select: 'firstName lastName' })
  // If patient has a waiting token, compute its position among waiting tokens for that doctor/date
  if (list && list.length) {
    const out = await Promise.all(list.map(async (t) => {
      const obj = t.toObject()
      if (obj.status === 'waiting') {
        const waiting = await req.db(QueueToken).find({ doctor: obj.doctor, date: obj.date, status: 'waiting' }).sort({ number: 1 })
        const pos = waiting.findIndex(w => String(w._id) === String(t._id))
        obj.position = pos >= 0 ? pos + 1 : null
      } else {
        obj.position = null
      }
      return obj
    }))
    return res.json(out)
  }
  res.json(list)
})

// Post a message to a token (simple chat while waiting)
router.post('/:id/message', protect, async (req, res) => {
  try {
    const { text } = req.body
    if (!text) return res.status(400).json({ error: 'Text required' })
    const token = await req.db(QueueToken).findById(req.params.id)
    if (!token) return res.status(404).json({ error: 'Token not found' })
    // determine sender role
    const sender = req.user.role === 'doctor' ? 'doctor' : (req.user.role === 'patient' ? 'patient' : 'system')
    // prevent patients from messaging when payment is required but not yet completed
    if (sender === 'patient' && token.paymentRequired && token.paymentStatus !== 'paid') {
      return res.status(403).json({ error: 'Payment required to send messages', paymentRequired: true })
    }
    token.messages = token.messages || []
    token.messages.push({ sender, text, createdAt: new Date() })
    await token.save()
    const populated = await req.db(QueueToken).findById(token._id).populate({ path: 'patient', select: 'firstName lastName phone email' }).populate({ path: 'doctor', select: 'name' })
    res.json(populated)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Server error' })
  }
})

// Join queue as currently authenticated patient
router.post('/join', protect, async (req, res) => {
  try {
    const { doctorId, date, patientName, notes, slotStart } = req.body
    // allow either date or slotStart (datetime). If slotStart provided derive date
    let finalDate = date
    if (!finalDate && slotStart) {
        try { finalDate = istDateString(new Date(slotStart)) } catch (e) { }
    }
    if (!doctorId || !finalDate) return res.status(400).json({ error: 'doctorId and date (or slotStart) required' })
    // block joining for inactive/deleted doctors
    try {
      const prof = await req.db(DoctorProfile).findOne({ user: doctorId })
      if (!prof || prof.active === false) return res.status(400).json({ error: 'Doctor not available' })
    } catch (e) { }
    // find patient record by user email
    const patientModel = (await import('../models/Patient.js')).default
    let patient = await patientModel.findOne({ email: req.user.email })
    // if no patient record, create a simple one from user info
    if (!patient) {
      patient = await patientModel.create({ firstName: req.user.name || 'Patient', email: req.user.email })
    }
    // prevent duplicate token for same doctor/date unless previous token was skipped
    const existing = await req.db(QueueToken).findOne({ doctor: doctorId, date: finalDate, patient: patient._id })
    if (existing && existing.status !== 'skipped') return res.status(409).json({ error: 'Already in queue', token: existing })
    const last = await req.db(QueueToken).findOne({ doctor: doctorId, date }).sort({ number: -1 })
    const nextNumber = last ? last.number + 1 : 1
    const nameToUse = patientName || `${patient.firstName}${patient.lastName ? ' ' + patient.lastName : ''}`
    const token = await req.db(QueueToken).create({
      doctor: doctorId,
      date: finalDate,
      number: nextNumber,
      patientName: nameToUse,
      patient: patient._id,
      notes: notes || undefined,
      slotStart: slotStart ? new Date(slotStart) : undefined,
      source: 'virtual-room'
    })
    // populate patient and doctor for immediate consumption by frontend
    const populated = await req.db(QueueToken).findById(token._id).populate({ path: 'patient', select: 'firstName lastName phone email inpatient avatarUrl' }).populate({ path: 'doctor', select: 'name' })
    res.status(201).json(populated)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Server error' })
  }
})

export default router;
