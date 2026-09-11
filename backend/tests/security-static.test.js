import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from '@jest/globals'

const root = path.resolve(process.cwd())
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')

describe('security architecture regression checks', () => {
  it('keeps forced RLS in the migration source', () => {
    const sql = read('migrateSQL/0035_enable_row_level_security.sql')
    expect(sql).toMatch(/ENABLE ROW LEVEL SECURITY/i)
    expect(sql).toMatch(/FORCE ROW LEVEL SECURITY/i)
    expect(sql).toMatch(/current_setting\(('{2})?app\.current_tenant_id/i)
  })

  it('detects destructive schema reset tooling for release review', () => {
    const script = read('runMigrations.js')
    expect(script).toMatch(/DROP SCHEMA public CASCADE/i)
  })

  it('keeps tenant context in the Prisma transaction wrapper', () => {
    const db = read('src/config/db.js')
    expect(db).toMatch(/tenantStorage\.getStore\(\)/)
    expect(db).toMatch(/set_config\('app\.current_tenant_id'/)
    expect(db).toMatch(/tenantStorage\.run\(\{ tenantId, tx \}/)
  })

  it('does not allow the legacy query-token auth path to become a live route silently', () => {
    const app = read('src/app.js')
    expect(app).not.toMatch(/utils\/auth\.js/)
  })

  it('passes the authenticated FAQ role and tenant middleware into deletion', () => {
    const controller = read('src/controllers/faqController.js')
    const route = read('src/routes/faqs.js')
    expect(controller).toMatch(/userRole:\s*req\.userRole/)
    expect(route).toMatch(/requireTenant[\s\S]*FaqController\.remove/)
  })

  it('sends Razorpay initiation payloads as objects, not raw UUID strings', () => {
    const patientDashboard = read('../frontend/src/pages/dashboard/PatientDashboard.jsx')
    const invoicesList = read('../frontend/src/pages/invoices/InvoicesList.jsx')
    expect(patientDashboard).toMatch(/paymentsApi\.initiate\(\{ invoiceId \}\)/)
    expect(invoicesList).toMatch(/paymentsApi\.initiate\(\{ invoiceId \}\)/)
    expect(patientDashboard).not.toMatch(/paymentsApi\.initiate\(invoiceId\)/)
    expect(invoicesList).not.toMatch(/paymentsApi\.initiate\(invoiceId\)/)
  })

  it('binds payment verification to the stored Razorpay order and balance', () => {
    const paymentService = read('src/services/paymentService.js')
    expect(paymentService).toMatch(/invoice\.razorpay_order_id !== razorpayOrderId/)
    expect(paymentService).toMatch(/amountInPaise > remainingPaise/)
  })

  it('retries expired authenticated requests with the refreshed access token', () => {
    const client = read('../frontend/src/api/client.js')
    expect(client).toMatch(/includeToken = false/)
    expect(client).toMatch(/refreshSession\(\{ includeToken: true \}\)/)
    expect(client).toMatch(/requestWithToken\(path, opts, refreshed\.accessToken\)/)
    expect(client).toMatch(/Authorization = `Bearer \$\{token\}`/)
  })
})
