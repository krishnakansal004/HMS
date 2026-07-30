import { listAnalyticsSummaries, compileAnalyticsSummaries } from '../services/analyticsService.js'
import logActivity from '../utils/auditHelper.js'

function handleError(res, error, defaultMessage) {
  const status = Number(error.status) || 500
  const isClientError = status >= 400 && status < 500
  const message = isClientError ? (error.publicMessage || error.message || defaultMessage) : defaultMessage
  if (!isClientError) {
    console.error('[analyticsController] internal error', { status, error: error.message })
  } else {
    console.warn('[analyticsController] client error', { status, error: message })
  }
  return res.status(status).json({ error: message })
}

export async function getAnalyticsSummary(req, res) {
  try {
    const tenantId = req.tenant?._id || req.user?.tenantId
    const summaries = await listAnalyticsSummaries(req.db, tenantId)
    return res.json(summaries)
  } catch (error) {
    handleError(res, error, 'Failed to load business intelligence metrics')
  }
}

export async function recompileAnalytics(req, res) {
  try {
    const tenantId = req.tenant?._id || req.user?.tenantId
    const compiled = await compileAnalyticsSummaries(req.db, tenantId, 15)
    await logActivity(req, 'RECOMPILE_ANALYTICS', 'analytics_summary', String(tenantId), { days: 15, count: compiled.length })
    res.json({ message: 'Recompiled metrics successfully', data: compiled })
  } catch (error) {
    handleError(res, error, 'Failed to recompile stats')
  }
}
