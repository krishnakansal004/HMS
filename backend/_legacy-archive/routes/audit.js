import express from 'express';
import AuditLog from '../models/AuditLog.js';
import { protect } from '../utils/auth.js';
import { loadTenant } from '../utils/saas.js';
import { allowRolesWithSubadminFeature } from '../utils/permissions.js';

const router = express.Router();

// @desc    Get tenant-scoped audit logs
// @route   GET /api/audit
// @access  Private/Admin/Director/Subadmin
router.get('/', protect, loadTenant, allowRolesWithSubadminFeature(['admin', 'director', 'subadmin'], 'view_audit_logs'), async (req, res) => {
    try {
        const q = {};
        if (req.tenant) q.tenantId = req.tenant._id;

        // Fetch logs and sort by creation timestamp desc
        const logs = await req.db(AuditLog).find(q).sort({ createdAt: -1 }).limit(100);
        res.json(logs);
    } catch (e) {
        console.error('[auditRoute] Error fetching audit logs:', e);
        res.status(500).json({ error: 'Failed to retrieve audit logs' });
    }
});

export default router;
