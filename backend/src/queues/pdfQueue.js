import { Queue, Worker } from 'bullmq'
import { getRedisConnectionOptions } from './connection.js'
import PDFDocument from 'pdfkit'
import { uploadToCloudinary } from '../config/cloudinary.js'
import Invoice from '../models/Invoice.js'
import PlanReceipt from '../models/PlanReceipt.js'

const connection = getRedisConnectionOptions()

export const pdfQueue = new Queue('pdfQueue', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000
    },
    removeOnComplete: true,
    removeOnFail: 1000
  }
})

export async function addPdfJob(data) {
  return await pdfQueue.add('generate-pdf', data)
}

// Start Worker
const worker = new Worker('pdfQueue', async (job) => {
  const { invoiceId, tenantId, paidAt } = job.data
  console.log(`[Worker:pdfQueue] Compiling PDF for invoice ${invoiceId}, tenant ${tenantId}`)
  
  // Resolve models with tenant isolation
  const InvoiceModel = Invoice.forHospital(tenantId)
  const PlanReceiptModel = PlanReceipt.forHospital(tenantId)
  
  const invoice = await InvoiceModel.findById(invoiceId).populate('items.medicine')
  if (!invoice) {
    throw new Error(`Invoice ${invoiceId} not found`)
  }

  // Generate PDF buffer
  const doc = new PDFDocument({ margin: 50 })
  const chunks = []
  doc.on('data', (d) => chunks.push(d))
  const pdfDone = new Promise((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
  })

  doc.fontSize(18).text('Invoice', { align: 'center' })
  doc.moveDown(0.5)
  doc.fontSize(12).text(`Invoice Number: ${invoice.invoiceNumber || invoice._id}`)
  doc.text(`Date: ${new Date(invoice.createdAt).toLocaleString()}`)
  doc.text(`Customer: ${invoice.patientName}`)
  doc.moveDown()
  doc.fontSize(13).text('Items:')
  doc.moveDown(0.25)
  
  ;(invoice.items || []).forEach(it => {
    const unitPrice = (Number(it.unitPrice) || 0)
    const quantity = Number(it.quantity) || 0
    const gstRate = Number(it.gstRate) || 0
    const line = unitPrice * quantity
    const gst = line * (gstRate / 100)
    const name = it.medicine?.name || it.description || 'Item'
    doc.fontSize(11).text(`${name}  x${quantity} @ ${unitPrice.toFixed(2)}  GST ${gstRate}%  Line ${(line + gst).toFixed(2)}`)
  })
  
  doc.moveDown()
  const safeSubtotal = (Number.isFinite(invoice.subtotal) ? invoice.subtotal : 0)
  const safeGstTotal = (Number.isFinite(invoice.gstTotal) ? invoice.gstTotal : 0)
  const safeTotal = (Number.isFinite(invoice.total) ? invoice.total : (safeSubtotal + safeGstTotal))
  
  doc.fontSize(12).text(`Subtotal: ${safeSubtotal.toFixed(2)}`)
  doc.text(`GST: ${safeGstTotal.toFixed(2)}`)
  doc.text(`Total: ₹${safeTotal.toFixed(2)}`)
  
  if (invoice.paid && invoice.payment) {
    doc.fontSize(11).text(`Payment Status: Paid (${invoice.payment.provider})`)
    doc.text(`Transaction ID: ${invoice.payment.transactionId}`)
    doc.text(`Date: ${new Date(invoice.payment.paidAt).toLocaleString()}`)
  }
  doc.end()

  const pdfBuffer = await pdfDone

  // Upload to Cloudinary
  let pdfPath = ''
  try {
    const result = await uploadToCloudinary(pdfBuffer, 'plan-receipts', 'auto')
    pdfPath = result.secure_url
  } catch (e) {
    console.error('[Worker:pdfQueue] Cloudinary upload failed:', e.message)
    throw e
  }

  // Create PlanReceipt record
  console.log('[Worker:pdfQueue] Writing plan receipt PDF to', pdfPath)
  const pr = await PlanReceiptModel.create({
    invoice: invoice._id,
    invoiceNumber: invoice.invoiceNumber,
    plan: invoice.plan || null,
    billing: invoice.billing || {},
    total: invoice.total,
    paidAt: paidAt || invoice.payment?.paidAt || new Date(),
    pdfPath
  })

  if (pr && pr._id) {
    console.log('[Worker:pdfQueue] PlanReceipt created:', pr._id)
  } else {
    console.warn('[Worker:pdfQueue] PlanReceipt create returned empty')
  }
}, { connection })

worker.on('failed', (job, err) => {
  console.error(`[Worker:pdfQueue] Job ${job?.id} failed:`, err.message)
})

worker.on('completed', (job) => {
  console.log(`[Worker:pdfQueue] Job ${job.id} completed successfully`)
})
