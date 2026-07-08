import express from 'express'
import Expense from '../models/Expense.js'
import { protect, requireRoles } from '../utils/auth.js'

const router = express.Router()

// Director only: list all expenses
router.get('/', protect, requireRoles('director'), async (req, res) => {
  try {
    const list = await req.db(Expense).find({}).sort({ date: -1 })
    res.json({ expenses: list })
  } catch (e) {
    res.status(500).json({ error: 'Failed to load expenses' })
  }
})

// Director only: create expense
router.post('/', protect, requireRoles('director'), async (req, res) => {
  try {
    const { title, category, amount, date, description, attachments } = req.body
    if (!title || !amount) return res.status(400).json({ error: 'Title and amount required' })
    const created = await req.db(Expense).create({
      title,
      category: category || 'Other',
      amount: Number(amount) || 0,
      date: date || new Date().toISOString(),
      description,
      attachments: attachments || [],
      createdBy: req.userId
    })
    res.status(201).json({ expense: created })
  } catch (e) {
    res.status(500).json({ error: 'Failed to create expense' })
  }
})

// Director only: update expense
router.put('/:id', protect, requireRoles('director'), async (req, res) => {
  try {
    const { title, category, amount, date, description, attachments } = req.body
    const updated = await req.db(Expense).update(req.params.id, {
      title,
      category,
      amount: Number(amount),
      date,
      description,
      attachments
    })
    res.json({ expense: updated })
  } catch (e) {
    res.status(500).json({ error: 'Failed to update expense' })
  }
})

// Director only: delete expense
router.delete('/:id', protect, requireRoles('director'), async (req, res) => {
  try {
    await Expense.deleteOne({ _id: req.params.id })
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: 'Failed to delete' })
  }
})

export default router
