import express from 'express';
import AnalyticsSummary from '../models/AnalyticsSummary.js';
import Invoice from '../models/Invoice.js';
import Appointment from '../models/Appointment.js';
import Bed from '../models/Bed.js';
import Ward from '../models/Ward.js';
import LabOrder from '../models/LabOrder.js';
import { protect } from '../utils/auth.js';
import { loadTenant } from '../utils/saas.js';
import { allowRolesWithSubadminFeature } from '../utils/permissions.js';

const router = express.Router();

// Helper to format Date as YYYY-MM-DD in IST
function getIstDateString(date) {
    const d = new Date(date);
    d.setMinutes(d.getMinutes() + 330); // IST Offset (+5:30)
    return d.toISOString().split('T')[0];
}

// @desc    Get pre-aggregated daily summaries for the last 30 days
// @route   GET /api/analytics/summary
router.get('/summary', protect, loadTenant, allowRolesWithSubadminFeature(['admin', 'subadmin'], 'view_reports'), async (req, res) => {
    try {
        const tenantId = req.tenant?._id || req.user?.tenantId;
        if (!tenantId) return res.json([]);

        // Get records from the last 30 days
        const summaries = await req.db(AnalyticsSummary).find({}).sort({ date: 1 });
        
        // If empty, trigger a compile for the last 7 days so the user has immediate stats
        if (summaries.length === 0) {
            console.log('[analytics] summaries empty. Compiling immediate stats.');
            const compiled = await compileStatsForLastNDays(req, 7);
            return res.json(compiled);
        }

        res.json(summaries);
    } catch (e) {
        console.error('[analytics] summary error', e);
        res.status(500).json({ error: 'Failed to load business intelligence metrics' });
    }
});

// @desc    Force recompilation of daily summaries
// @route   POST /api/analytics/recompile
router.post('/recompile', protect, loadTenant, allowRolesWithSubadminFeature(['admin', 'subadmin'], 'view_reports'), async (req, res) => {
    try {
        const compiled = await compileStatsForLastNDays(req, 15);
        res.json({ message: 'Recompiled metrics successfully', data: compiled });
    } catch (e) {
        res.status(500).json({ error: 'Failed to recompile stats' });
    }
});

// Core daily aggregation compiler
async function compileStatsForLastNDays(req, nDays = 7) {
    const tenantId = req.tenant?._id || req.user?.tenantId;
    const compiledList = [];

    try {
        // Fetch clinical data collections in parallel (entire tenant set)
        const [invoices, appointments, beds, labOrders, wards] = await Promise.all([
            req.db(Invoice).find({}),
            req.db(Appointment).find({}),
            req.db(Bed).find({}),
            req.db(LabOrder).find({}),
            req.db(Ward).find({})
        ]);

        const totalBedsCount = beds.length || 10; // Fallback to avoid division by zero
        const occupiedBedsCount = beds.filter(b => b.isOccupied).length;
        const occupancyRate = Number(((occupiedBedsCount / totalBedsCount) * 100).toFixed(1));

        // Generate date strings and pre-fetch existing summaries in one batch
        const dateStrings = [];
        for (let i = nDays - 1; i >= 0; i--) {
            const dateCursor = new Date();
            dateCursor.setDate(dateCursor.getDate() - i);
            dateStrings.push(getIstDateString(dateCursor));
        }

        const existingSummaries = await req.db(AnalyticsSummary).find({ date: { $in: dateStrings } });
        const summariesMap = new Map(existingSummaries.map(s => [s.date, s]));

        const savePromises = [];

        for (let i = nDays - 1; i >= 0; i--) {
            const dateCursor = new Date();
            dateCursor.setDate(dateCursor.getDate() - i);
            const dateStr = getIstDateString(dateCursor);

            const startOfDay = new Date(dateCursor); startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(dateCursor); endOfDay.setHours(23, 59, 59, 999);

            // Filter invoices in memory
            const dayInvoices = invoices.filter(inv => {
                const d = inv.createdAt ? new Date(inv.createdAt) : null;
                return d && d >= startOfDay && d <= endOfDay;
            });
            const revenue = dayInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0);

            // Filter appointments
            const dayAppointments = appointments.filter(app => {
                const d = app.slotStart ? new Date(app.slotStart) : null;
                return d && d >= startOfDay && d <= endOfDay;
            });
            const consultsCount = dayAppointments.length;

            // Group doctor stats in memory
            const docMap = {};
            dayAppointments.forEach(app => {
                const docName = app.doctorName || 'General Practice';
                docMap[docName] = (docMap[docName] || 0) + 1;
            });
            const doctorStats = Object.entries(docMap).map(([name, count]) => ({ name, count }));

            // Pharmacy sales: count invoice items with medicine keywords
            let pharmacySales = 0;
            dayInvoices.forEach(inv => {
                if (Array.isArray(inv.items)) {
                    inv.items.forEach(it => {
                        const desc = String(it.description || '').toLowerCase();
                        if (desc.includes('medicine') || desc.includes('tab') || desc.includes('cap') || desc.includes('syr') || desc.includes('injection')) {
                            pharmacySales += (it.unitPrice || 0) * (it.quantity || 1);
                        }
                    });
                }
            });

            // LIS orders volume
            const dayLabsCount = labOrders.filter(o => {
                const d = o.createdAt ? new Date(o.createdAt) : null;
                return d && d >= startOfDay && d <= endOfDay;
            }).length;

            let summaryDoc = summariesMap.get(dateStr);

            const payload = {
                tenantId,
                date: dateStr,
                revenue: Number(revenue.toFixed(2)),
                consultsCount,
                occupancyRate,
                pharmacySales: Number(pharmacySales.toFixed(2)),
                labsCount: dayLabsCount,
                doctorStats,
                status: 'active'
            };

            if (summaryDoc) {
                // Update existing
                summaryDoc.revenue = payload.revenue;
                summaryDoc.consultsCount = payload.consultsCount;
                summaryDoc.occupancyRate = payload.occupancyRate;
                summaryDoc.pharmacySales = payload.pharmacySales;
                summaryDoc.labsCount = payload.labsCount;
                summaryDoc.doctorStats = payload.doctorStats;
                savePromises.push(summaryDoc.save().then(doc => {
                    compiledList.push(doc);
                }));
            } else {
                // Create new daily entry
                savePromises.push(req.db(AnalyticsSummary).create(payload).then(doc => {
                    compiledList.push(doc);
                }));
            }
        }

        await Promise.all(savePromises);
    } catch (e) {
        console.error('[analytics] Compilation helper error:', e.message);
    }

    return compiledList;
}

export default router;
