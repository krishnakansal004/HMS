#!/usr/bin/env node
import dotenv from 'dotenv'
import Tenant from '../models/Tenant.js'
import { sendEmail } from './notify.js'

dotenv.config()

async function suspendExpiredTenants() {
  try {
    const now = new Date()
    const expired = await Tenant.find({ status: 'active', subscriptionEnd: { $lte: now } })
    console.log('[subscriptionJobs] found', expired.length, 'expired tenants')
    for (const t of expired) {
      try {
        t.status = 'suspended'
        await t.save()
        console.log('[subscriptionJobs] suspended tenant', t._id, t.name)
        // notify director if possible (best-effort)
        try {
          const directorEmail = (t.director && (await import('../models/User.js')).default.findById
            ? null
            : null)
        } catch (e) { /* ignore */ }
      } catch (e) {
        console.error('[subscriptionJobs] failed to suspend tenant', t._id, e)
      }
    }
  } catch (e) {
    console.error('[subscriptionJobs] error', e)
  }
}

if (process.argv[1] && process.argv[1].endsWith('subscriptionJobs.js')) {
  suspendExpiredTenants().then(() => process.exit(0)).catch(() => process.exit(1))
}

export { suspendExpiredTenants }
