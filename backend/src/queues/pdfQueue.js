import { Queue, Worker } from 'bullmq';
import { getRedisConnectionOptions } from './connection.js';
import PDFDocument from 'pdfkit';
import { uploadToCloudinary } from '../config/cloudinary.js';
import { db, tenantStorage } from '../config/db.js';

const connection = getRedisConnectionOptions();

export const pdfQueue = new Queue('pdfQueue', {
  connection,
  defaultJobOptions: { 
    attempts: 3, 
    backoff: { type: 'exponential', delay: 5000 }, 
    removeOnComplete: true, 
    removeOnFail: 1000 
  }
});

export async function addPdfJob(data) {
  return await pdfQueue.add('generate-pdf', data);
}

const worker = new Worker('pdfQueue', async (job) => {
  const { invoiceId, tenantId, paidAt } = job.data;
  console.log(`[Worker:pdfQueue] Compiling PDF for invoice ${invoiceId}, tenant ${tenantId}`);

  // 1. Fetch using Prisma strictly inside the tenant context
  const invoice = await tenantStorage.run({ tenantId }, () => {
    return db.invoice.findUnique({
      where: { invoice_id: invoiceId },
      include: {
        patient: true,
        payment: true,
        invoice_item: { include: { medicine: true } }
      }
    });
  });

  if (!invoice) throw new Error(`Invoice ${invoiceId} not found`);

  // 2. Document Generation
  const doc = new PDFDocument({ margin: 50 });
  const chunks = [];
  doc.on('data', (d) => chunks.push(d));

  const pdfDone = new Promise((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  doc.fontSize(18).text('Invoice', { align: 'center' }).moveDown(0.5);
  doc.fontSize(12).text(`Invoice Number: ${invoice.invoice_number}`);
  doc.text(`Date: ${new Date(invoice.created_at).toLocaleString()}`);
  doc.text(`Patient: ${invoice.patient?.first_name} ${invoice.patient?.last_name || ''}`).moveDown();

  doc.fontSize(13).text('Items:').moveDown(0.25);
  
  (invoice.invoice_item || []).forEach(it => {
    // Database stores minor currency (Paise), convert to display format (Rupees)
    const unitPrice = Number(it.unit_price_snapshot) / 100; 
    const quantity = it.quantity;
    const gstRate = Number(it.gst_rate_snapshot);
    
    const line = unitPrice * quantity;
    const gst = line * (gstRate / 100);
    const name = it.item_name_snapshot;
    
    doc.fontSize(11).text(`${name}  x${quantity} @ ₹${unitPrice.toFixed(2)}  GST ${gstRate}%  Line: ₹${(line + gst).toFixed(2)}`);
  });

  doc.moveDown();

  // Convert aggregates to display format
  const subtotalDisplay = Number(invoice.subtotal) / 100;
  const gstDisplay = Number(invoice.gst_total) / 100;
  const totalDisplay = Number(invoice.total) / 100;

  doc.fontSize(12).text(`Subtotal: ₹${subtotalDisplay.toFixed(2)}`);
  doc.text(`GST: ₹${gstDisplay.toFixed(2)}`);
  doc.text(`Total:  ₹${totalDisplay.toFixed(2)}`);

  const paidPayment = invoice.payment?.find(p => p.status === 'success');
  if (invoice.paid && paidPayment) {
    doc.fontSize(11).text(`Payment Status: Paid (${paidPayment.method})`);
    doc.text(`Transaction ID: ${paidPayment.transaction_id || 'N/A'}`);
    doc.text(`Date: ${new Date(paidPayment.created_at).toLocaleString()}`);
  }

  doc.end();
  const pdfBuffer = await pdfDone;

  // 3. Upload to Cloudinary
  let pdfPath = '';
  try {
    const result = await uploadToCloudinary(pdfBuffer, 'invoices', 'auto');
    pdfPath = result.secure_url;
  } catch (e) {
    console.error('[Worker:pdfQueue] Cloudinary upload failed:', e.message);
    throw e;
  }

  // 4. Resolve Target Plan ID (Fallback for subscription invoices)
  const tenant = await tenantStorage.run({ tenantId }, () =>
    db.tenant.findUnique({ where: { tenant_id: tenantId } })
  );
  
  const targetPlanId = invoice.plan_id || tenant?.plan_id;

  // 5. Record Receipt (Only if tied to a subscription plan)
  if (targetPlanId) {
    const pr = await tenantStorage.run({ tenantId }, () => {
      return db.plan_receipt.create({
        data: {
          tenant_id: tenantId,
          invoice_id: invoice.invoice_id,
          plan_id: targetPlanId,
          total: invoice.total,
          paid_at: paidAt || paidPayment?.created_at || new Date(),
          pdf_url: pdfPath,
          pdf_path: pdfPath
        }
      });
    });
    console.log('[Worker:pdfQueue] PlanReceipt created:', pr.receipt_id);
  } else {
    console.log('[Worker:pdfQueue] Standard patient invoice generated, no plan_receipt required.');
  }

}, { connection });

worker.on('failed', (job, err) => console.error(`[Worker:pdfQueue] Job ${job?.id} failed:`, err.message));
worker.on('completed', (job) => console.log(`[Worker:pdfQueue] Job ${job?.id} completed successfully`));