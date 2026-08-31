import PDFDocument from 'pdfkit';
import { uploadToCloudinary } from '../config/cloudinary.js';
import { db, tenantStorage } from '../config/db.js';

export async function generateAndUploadInvoicePdf(invoiceId, tenantId) {
  try {
    const run = (fn) => tenantId ? tenantStorage.run({ tenantId }, fn) : fn();
    
    const invoice = await run(() => db.invoice.findUnique({
      where: { invoice_id: invoiceId },
      include: {
        patient: true,
        invoice_item: { include: { medicine: true } }
      }
    }));

    if (!invoice) {
      console.warn(`[invoicePdfHelper] Invoice ${invoiceId} not found`);
      return;
    }

    const doc = new PDFDocument({ margin: 50 });
    const chunks = [];
    doc.on('data', (d) => chunks.push(d));

    const pdfBufferPromise = new Promise((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });

    doc.fontSize(18).text('Invoice', { align: 'center' }).moveDown(0.5);
    doc.fontSize(12).text(`Invoice Number: ${invoice.invoice_number}`);
    doc.text(`Date: ${new Date(invoice.created_at).toLocaleString()}`);
    doc.text(`Patient: ${invoice.patient?.first_name} ${invoice.patient?.last_name || ''}`);
    
    doc.fillColor(invoice.paid ? 'green' : 'red').text(`Status: ${invoice.paid ? 'PAID' : 'UNPAID'}`);
    doc.fillColor('black').moveDown().fontSize(13).text('Items:').moveDown(0.25);

    invoice.invoice_item.forEach(it => {
      const unitPrice = Number(it.unit_price_snapshot) / 100;
      const quantity = Number(it.quantity);
      const gstRate = Number(it.gst_rate_snapshot);
      const line = unitPrice * quantity;
      const gst = line * (gstRate / 100);
      const name = it.item_name_snapshot;
      doc.fontSize(11).text(`${name}  x${quantity} @ ${unitPrice.toFixed(2)}  GST ${gstRate}%  Line ${(line + gst).toFixed(2)}`);
    });

    doc.moveDown();
    doc.fontSize(12).text(`Subtotal: ${(Number(invoice.subtotal) / 100).toFixed(2)}`);
    doc.text(`GST: ${(Number(invoice.gst_total) / 100).toFixed(2)}`);
    doc.text(`Total: ${(Number(invoice.total) / 100).toFixed(2)}`);
    doc.end();

    const pdfBuffer = await pdfBufferPromise;
    const cldObj = await uploadToCloudinary(pdfBuffer, 'invoices', 'raw');
    
    // Attach URL back to document metadata table
    await run(() => db.document.create({
      data: {
        tenant_id: invoice.tenant_id,
        entity_type: 'INVOICE',
        entity_id: invoice.invoice_id,
        url: cldObj.secure_url,
        mime_type: 'application/pdf'
      }
    }));
    
    console.log(`[invoicePdfHelper] Uploaded invoice PDF to Cloudinary: ${cldObj.secure_url}`);
  } catch (err) {
    console.error(`[invoicePdfHelper] Failed to generate/upload invoice PDF:`, err);
  }
}