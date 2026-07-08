import express from 'express'
import Faq from '../models/Faq.js'
import { authMiddleware, admin } from '../utils/auth.js'

const router = express.Router()

// Public: list FAQs for a role (returns general + role-specific entries)
router.get('/', async (req, res) => {
  try {
    const role = (req.query.role || 'general').toString().toLowerCase()
    // return FAQs that are either general or include the requested role
    const docs = await Faq.find({ roles: { $in: ['general', role] } }).sort({ createdAt: -1 })
    return res.json(docs)
  } catch (e) {
    console.error('faqs:get', e)
    return res.status(500).json({ error: 'Failed to list faqs' })
  }
})

// Admin-only CRUD
router.post('/', authMiddleware, admin, async (req, res) => {
  try {
    const { question, answer, roles } = req.body
    if (!question || !answer) return res.status(400).json({ error: 'question and answer required' })
    const doc = await Faq.create({ question, answer, roles: Array.isArray(roles) ? roles : [roles], createdBy: req.userId })
    return res.json(doc)
  } catch (e) {
    console.error('faqs:create', e)
    return res.status(500).json({ error: 'Failed to create faq' })
  }
})

router.put('/:id', authMiddleware, admin, async (req, res) => {
  try {
    const { id } = req.params
    const { question, answer, roles } = req.body
    const existing = await Faq.findById(id)
    if (!existing) return res.status(404).json({ error: 'Not found' })
    const doc = await Faq.update(id, { question, answer, roles: Array.isArray(roles) ? roles : [roles] })
    return res.json(doc)
  } catch (e) {
    console.error('faqs:update', e)
    return res.status(500).json({ error: 'Failed to update faq' })
  }
})

router.delete('/:id', authMiddleware, admin, async (req, res) => {
  try {
    const { id } = req.params
    const existing = await Faq.findById(id)
    if (existing) await Faq.delete(id)
    return res.json({ ok: true })
  } catch (e) {
    console.error('faqs:delete', e)
    return res.status(500).json({ error: 'Failed to delete faq' })
  }
})

export default router
