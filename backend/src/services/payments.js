import Invoice from '../models/Invoice.js'
import PaymentRequest from '../models/PaymentRequest.js'

// Compute amount (in rupees) from a Plan object and a period string
// Note: plan.prices are stored in paise, so we divide by 100 to get rupees.
export function computeAmountFromPlan(plan, period = 'monthly', requestedAmount = 0) {
  if (!plan) return Number(requestedAmount) || 0
  let amount = 0
  // 1. If customized, check durations array first
  if (plan.customized && Array.isArray(plan.durations) && plan.durations.length > 0) {
    const wanted = (() => {
      switch ((period || '').toLowerCase()) {
        case '3months': return { unit: 'months', length: 3 }
        case 'yearly': return { unit: 'years', length: 1 }
        case '5years': return { unit: 'years', length: 5 }
        default: return { unit: 'months', length: 1 }
      }
    })()
    const found = plan.durations.find(d => (d.unit === wanted.unit || (d.unit + 's') === wanted.unit) && Number(d.length) === wanted.length)
    if (found && typeof found.price !== 'undefined') {
      amount = Number(found.price) / 100 // Assume stored as paise
    }
  }

  // 2. If not found in durations, check standard prices object
  if (!amount && plan.prices) {
    switch ((period || '').toLowerCase()) {
      case '3months': amount = plan.prices.threeMonths || plan.prices['3months'] || 0; break
      case 'yearly': amount = plan.prices.year || plan.prices.yearly || 0; break
      case '5years': amount = plan.prices.fiveYears || 0; break
      default: amount = plan.prices.month || plan.prices.monthly || 0
    }
    if (amount) {
      amount = amount / 100; // Convert from paise to rupees
    } else {
      const base = plan.prices.month || plan.prices.monthly || 0
      if (base) {
        if (period === '3months') amount = (base * 3) / 100
        else if (period === 'yearly') amount = (base * 12) / 100
        else if (period === '5years') amount = (base * 60) / 100
        else amount = base / 100
      }
    }
  }
  if ((!amount || Number(amount) === 0) && requestedAmount) amount = Number(requestedAmount) || 0
  return Number(amount || 0)
}

// Create an Invoice and a PaymentRequest, and attempt to create a Razorpay payment link.
// items: array of { description, quantity, unitPrice (Rupees), gstRate }
// billing: { name, email, company, address, phone, countryCode, period }
// createdBy and createdByRole are optional audit fields
export async function createInvoiceAndPaymentRequest({ patientName, items = [], billing = {}, plan = null, createdBy = null, createdByRole = 'public', tenantId = null, planRequestId = null }) {
  // Build invoice payload - Invoice expects unitPrice in RUPEES
  const invPayload = {
    patientName: patientName || (billing && billing.name) || 'Customer',
    items: items.map(it => ({ description: it.description || '', quantity: it.quantity || 1, unitPrice: Number(it.unitPrice || 0), gstRate: Number(it.gstRate || 0) })),
    subtotal: 0,
    gstTotal: 0,
    total: 0,
    paid: false,
    createdBy: createdBy || null,
    createdByRole: createdByRole || 'public',
    billing: billing || {}
  }
  try {
    invPayload.subtotal = (invPayload.items || []).reduce((s, it) => s + (Number(it.unitPrice || 0) * Number(it.quantity || 0)), 0)
    invPayload.gstTotal = (invPayload.items || []).reduce((s, it) => s + ((Number(it.unitPrice || 0) * Number(it.quantity || 0)) * (Number(it.gstRate || 0) / 100)), 0)
    invPayload.total = Number(invPayload.subtotal || 0) + Number(invPayload.gstTotal || 0)
    if (plan && plan._id) invPayload.plan = plan._id
    if (tenantId) invPayload.tenantId = tenantId

    const InvoiceModel = tenantId ? Invoice.forHospital(tenantId) : Invoice
    const inv = await InvoiceModel.create(invPayload)

    // Create PaymentRequest: items and total in rupees
    const prItems = (inv.items || []).map(it => ({ description: it.description || '', quantity: it.quantity || 1, unitPrice: Number(it.unitPrice || 0), gstRate: Number(it.gstRate || 0) }))
    const subtotal = prItems.reduce((s, it) => s + (Number(it.unitPrice || 0) * Number(it.quantity || 0)), 0)
    const gstTotal = prItems.reduce((s, it) => s + ((Number(it.unitPrice || 0) * Number(it.quantity || 0)) * (Number(it.gstRate || 0) / 100)), 0)
    const total = subtotal + gstTotal
    const PRModel = tenantId ? PaymentRequest.forHospital(tenantId) : PaymentRequest
    const newPR = PRModel._wrap({ patientName: inv.patientName || '', items: prItems, subtotal, gstTotal, total, createdBy: createdBy || null, createdByRole: createdByRole || 'public', email: inv.billing?.email || '', phone: inv.billing?.phone || '' })
    newPR.invoice = inv._id
    if (tenantId) newPR.tenantId = tenantId
    if (planRequestId) newPR.planRequestId = planRequestId
    await newPR.save()

    let paymentShortUrl = null
    let paymentLinkId = null
    // Try to create Razorpay payment link if configured
    if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
      try {
        const Razorpay = (await import('razorpay')).default
        const razor = new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET })
        let amountPaise = Math.round(Number(newPR.total) * 100)
        // Razorpay test mode has a ₹5,00,000 limit. Cap it in test mode to allow testing large plans.
        if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_ID.startsWith('rzp_test_') && amountPaise > 50000000) {
          console.warn(`[payments] Capping test amount from ${amountPaise} to 50000000 to avoid Razorpay test mode limit`);
          amountPaise = 50000000;
        }
        const linkPayload = {
          amount: amountPaise,
          currency: 'INR',
          accept_partial: false,
          description: `Invoice for ${newPR.patientName}`,
          reference_id: String(newPR._id),
          customer: { name: newPR.patientName, contact: newPR.phone || undefined, email: newPR.email || undefined },
          notify: { sms: false, email: Boolean(newPR.email && String(newPR.email).includes('@')) },
          reminder_enable: false
        }
        try {
          const link = await razor.paymentLink.create(linkPayload)
          newPR.razorpay = { linkId: link.id, shortUrl: link.short_url, status: link.status }
          await newPR.save()
          paymentShortUrl = link.short_url
          paymentLinkId = link.id
        } catch (errLink) {
          console.error('[payments] razorpay create failed', errLink)
          const statusCode = errLink && errLink.statusCode
          const desc = errLink && errLink.error && errLink.error.description ? String(errLink.error.description) : (errLink && errLink.message ? String(errLink.message) : null)
          newPR.razorpay = newPR.razorpay || {}
          newPR.razorpay.status = 'create_failed'
          newPR.razorpay.error = desc || (statusCode ? `status:${statusCode}` : 'unknown')
          await newPR.save().catch(() => { })
          if (statusCode === 400 && desc && desc.toLowerCase().includes('amount exceeds')) {
            return { invoice: inv, paymentRequest: newPR, error: 'amount exceeds maximum amount allowed by Razorpay', detail: desc }
          }
        }
      } catch (e) {
        console.error('[payments] failed to create razorpay link', e)
      }
    }

    return { invoice: inv, paymentRequest: newPR, paymentShortUrl, paymentLinkId }
  } catch (e) {
    console.error('[payments] createInvoiceAndPaymentRequest error', e)
    throw e
  }
}

export default {
  computeAmountFromPlan,
  createInvoiceAndPaymentRequest
}
