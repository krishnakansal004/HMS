import express from 'express'
import Setting from '../models/Setting.js'
import { protect, requireRoles } from '../utils/auth.js'

const router = express.Router()

// GET /api/settings
// List all settings (protected, directors only?)
// Some settings might be public (like company name). Ideally handle public/private split.
// For now, let's allow public read for some keys, or authenticated read?
// The frontend usually needs COMPANY_NAME before login. That comes from 'public' endpoints usually.
// Here we'll implement the management API for Directors.
router.get('/', protect, requireRoles('director'), async (req, res) => {
    try {
        const settings = await req.db(Setting).find({}).sort({ group: 1, key: 1 })
        res.json(settings)
    } catch (e) {
        res.status(500).json({ error: 'Failed to load settings' })
    }
})

// POST /api/settings/bulk
// Update multiple settings at once
router.post('/bulk', protect, requireRoles('director'), async (req, res) => {
    try {
        const updates = req.body // { key: value, key2: value2 }
        if (!updates || typeof updates !== 'object') return res.status(400).json({ error: 'Invalid body' })
        const keys = Object.keys(updates)

        const existing = await req.db(Setting).find({ key: { $in: keys } })
        const existingMap = new Map(existing.map(s => [s.key, s]))

        await Promise.all(keys.map(async (key) => {
            const val = updates[key]
            const doc = existingMap.get(key)
            if (doc) {
                await req.db(Setting).update(doc._id, { value: val, updatedBy: req.userId })
            } else {
                await req.db(Setting).create({ key, value: val, updatedBy: req.userId })
            }
        }))
        res.json({ ok: true, updated: keys.length })
    } catch (e) {
        console.error('settings update error', e)
        res.status(500).json({ error: 'Failed to update settings' })
    }
})

// Public endpoint to get essential config (company name, logo)
// Mounted at /api/settings/public
router.get('/public', async (req, res) => {
    try {
        const publicKeys = ['COMPANY_NAME', 'COMPANY_LOGO', 'THEME_COLOR']
        const settings = await req.db(Setting).find({ key: { $in: publicKeys } })
        const out = {}
        settings.forEach(s => out[s.key] = s.value)
        // Defaults if missing
        if (!out.COMPANY_NAME) out.COMPANY_NAME = process.env.COMPANY_NAME || 'HospitechVerse'
        res.json(out)
    } catch (e) {
        res.status(500).json({ error: 'Failed' })
    }
})

export default router
