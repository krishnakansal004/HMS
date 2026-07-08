import express from 'express';
import PrescriptionTemplate from '../models/PrescriptionTemplate.js';
import { protect, doctor } from '../utils/auth.js';
import tenantMiddleware from '../utils/tenant.js'

const router = express.Router();

// List templates (current doctor)
router.get('/', protect, tenantMiddleware, doctor, async (req, res) => {
  const q = { createdBy: req.userId }
  if (req.tenant) q.tenantId = req.tenant._id
  const list = await req.db(PrescriptionTemplate).find(q).sort({ name: 1 });
  res.json(list);
});

// Create template
router.post('/', protect, tenantMiddleware, doctor, async (req, res) => {
  const { name, medicines, tests, notes, html } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  const tpl = await req.db(PrescriptionTemplate).create({ name, medicines, tests, notes, html, createdBy: req.userId, });
  res.status(201).json(tpl);
});

// Update template
router.put('/:id', protect, tenantMiddleware, doctor, async (req, res) => {
  const tpl = await req.db(PrescriptionTemplate).findOne({ _id: req.params.id, createdBy: req.userId, ...(req.tenant ? { } : {}) });
  if (!tpl) return res.status(404).json({ error: 'Template not found' });
  ['name', 'medicines', 'tests', 'notes', 'html'].forEach(f => { if (req.body[f] !== undefined) tpl[f] = req.body[f]; });
  await tpl.save();
  res.json(tpl);
});

// Delete template
router.delete('/:id', protect, tenantMiddleware, doctor, async (req, res) => {
  const filter = { _id: req.params.id, createdBy: req.userId, ...(req.tenant ? { } : {}) }
  const tpl = await req.db(PrescriptionTemplate).findOne(filter)
  if (!tpl) return res.status(404).json({ error: 'Template not found' })
  await req.db(PrescriptionTemplate).delete(tpl._id)
  res.json({ message: 'Deleted' })
})

export default router;
