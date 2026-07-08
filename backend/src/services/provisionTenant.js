import bcrypt from 'bcryptjs'
import Tenant from '../models/Tenant.js'
import User from '../models/User.js'
import Plan from '../models/Plan.js'

// Generate a preset password (user-friendly format)
function genPresetPassword() {
  const words = ['Health', 'Care', 'Med', 'Life', 'Care', 'Plus', 'Well', 'Safe']
  const numbers = Math.floor(1000 + Math.random() * 9000) // 4-digit number
  const word = words[Math.floor(Math.random() * words.length)]
  return `${word}@${numbers}`
}

// Add months helper
function addMonths(date, months) {
  const d = new Date(date)
  d.setMonth(d.getMonth() + months)
  return d
}

// Provision a tenant and an initial user from an invoice for plan purchases.
// Returns { tenant, user, presetPassword }
export async function provisionTenantForInvoice(invoice) {
  if (!invoice) throw new Error('Missing invoice')
  // If already provisioned, return early
  if (invoice.tenant) {
    const tenant = await Tenant.findById(invoice.tenant)
    const user = invoice.billing?.email ? await User.findOne({ email: String(invoice.billing.email).toLowerCase() }) : null
    // Backfill tenant linkage if it is missing or drifted; this is required for tenant-portal login.
    if (tenant && user && String(user.tenantId || '') !== String(tenant._id || '')) {
      user.tenantId = tenant._id
      if (!user.username) user.username = user.email
      if (!user.role || user.role === 'director') user.role = 'admin'
      await user.save()
      console.log('[provision] backfilled user tenant linkage', { email: user.email, tenantId: tenant._id })
    }

    // Ensure the user is unblocked even on early exits for already provisioned tenants
    if (user && (user.blocked || user.pendingInvoiceId)) {
      user.blocked = false;
      user.pendingInvoiceId = null;
      await user.save();
      console.log('[provision] unblocked user on early exit', { email: user.email });
    }

    return { tenant, user, presetPassword: null }
  }

  // Determine billing contact
  const billing = invoice.billing || {}
  const planId = invoice.plan
  const plan = planId ? await Plan.findById(planId) : null

  // Decide role: prefer admin if plan allows admins, otherwise doctor if plan allows doctors
  let roleToCreate = 'admin'
  if (plan) {
    const limits = plan.limits || {}
    if ((limits.admins || 0) <= 0 && (limits.doctors || 0) > 0) roleToCreate = 'doctor'
  }

  const name = billing.name || invoice.patientName || (billing.company || 'Customer')
  const email = (billing.email || '').toLowerCase()
  const company = billing.company || ''

  // Generate a fresh preset password for the user and always persist it
  // so the mailed credentials are valid even when the email already exists.
  const presetPassword = genPresetPassword()
  const passwordHash = await bcrypt.hash(presetPassword, 10)
  console.log('[provision] generated password', { email, presetPasswordLength: presetPassword.length, passwordHashLength: passwordHash.length })

  // Create user first (without tenantId yet). 
  let userDoc = await User.findOne({ email });
  if (!userDoc) {
    userDoc = await User.create({
      name,
      email,
      username: email,
      passwordHash,
      role: roleToCreate,
      phone: billing.phone,
      mustChangePassword: true
    })
    console.log('[provision] user created', { email, userId: userDoc._id, hasPasswordHash: !!userDoc.passwordHash })
  } else {
    // Existing user: rotate to a new preset password so mailed credentials are always usable.
    userDoc.passwordHash = passwordHash
    userDoc.role = roleToCreate
    userDoc.mustChangePassword = true
    if (!userDoc.username) userDoc.username = email
    if (billing.phone && !userDoc.phone) userDoc.phone = billing.phone
    console.log('[provision] user exists; rotating password for provisioning', { email, userId: userDoc._id, hasPasswordHash: !!userDoc.passwordHash })
  }

  // Create tenant owned by this user
  const tenantName = company || name
  const now = new Date()
  const provisionedAt = now
  let subscriptionEnd = null
  const period = (billing.period || '').toLowerCase()
  if (period === '3months') subscriptionEnd = addMonths(now, 3)
  else if (period === 'yearly' || period === 'year') subscriptionEnd = addMonths(now, 12)
  else if (period === '5years') subscriptionEnd = addMonths(now, 60)
  else subscriptionEnd = addMonths(now, 1)

  // Determine tenant director: use configured SaaS owner if present (single director across SaaS)
  const ownerId = process.env.SAAS_OWNER_ID || userDoc._id

  // Generate unique slug for the hospital portal
  let slug = tenantName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || `hospital-${Date.now()}`
  let suffix = 1
  const originalSlug = slug
  while (true) {
    const existing = await Tenant.findOne({ slug })
    if (!existing) break
    slug = `${originalSlug}-${suffix++}`
  }

  const tenant = await Tenant.create({ name: tenantName, slug, director: ownerId, plan: planId || null, provisionedAt, subscriptionStart: provisionedAt, subscriptionEnd, status: 'active' })

  // Always attach the provisioned user to the tenant to satisfy portal login checks.
  // This remains valid even when SAAS_OWNER_ID is used as tenant.director.
  userDoc.tenantId = tenant._id
  userDoc.role = roleToCreate
  userDoc.mustChangePassword = true
  userDoc.blocked = false
  userDoc.pendingInvoiceId = null
  if (!userDoc.username) userDoc.username = email
  await userDoc.save()

  // Update tenant usage counters best-effort
  tenant.usage = tenant.usage || { admins: 0, subAdmins: 0, doctors: 0, patients: 0 }
  if (roleToCreate === 'admin') tenant.usage.admins = (tenant.usage.admins || 0) + 1
  else if (roleToCreate === 'doctor') tenant.usage.doctors = (tenant.usage.doctors || 0) + 1
  await tenant.save()

  return { tenant, user: userDoc, presetPassword }
}

export default { provisionTenantForInvoice }
