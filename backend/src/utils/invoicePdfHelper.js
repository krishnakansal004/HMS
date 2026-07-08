import PDFDocument from 'pdfkit'
import Invoice from '../models/Invoice.js'
import { uploadToCloudinary } from '../config/cloudinary.js'

export async function generateAndUploadInvoicePdf(invoiceId, tenantId) {
  try {
    const InvoiceModel = tenantId ? Invoice.forHospital(tenantId) : Invoice;
    const invoice = await InvoiceModel.findById(invoiceId).populate('items.medicine');
    if (!invoice) {
      console.warn(`[invoicePdfHelper] Invoice ${invoiceId} not found in tenant ${tenantId}`);
      return;
    }

    const doc = new PDFDocument({ margin: 50 });
    const chunks = [];
    doc.on('data', (d) => chunks.push(d));
    
    const pdfBufferPromise = new Promise((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err) => reject(err));
    });

    doc.fontSize(18).text('Invoice', { align: 'center' })
    doc.moveDown(0.5)
    doc.fontSize(12).text(`Invoice Number: ${invoice.invoiceNumber || invoice._id}`)
    doc.text(`Date: ${new Date(invoice.createdAt).toLocaleString()}`)
    doc.text(`Patient: ${invoice.patientName}`)
    if (invoice.doctorName) doc.text(`Doctor: ${invoice.doctorName}`)
    if (invoice.paid) {
      doc.fontSize(12).fillColor('green').text('Status: PAID')
    } else {
      doc.fontSize(12).fillColor('red').text('Status: UNPAID')
    }
    doc.fillColor('black') // reset color
    doc.moveDown()
    doc.fontSize(13).text('Items:')
    doc.moveDown(0.25)
    invoice.items.forEach(it => {
      const num = (v) => {
        const n = Number(v)
        return Number.isFinite(n) ? n : 0
      }
      const unitPrice = num(it.unitPrice ?? it.medicine?.sellingPrice)
      const quantity = num(it.quantity)
      const gstRate = num(it.gstRate ?? it.medicine?.gstRate)
      const line = unitPrice * quantity
      const gst = line * (gstRate / 100)
      const isConsult = (!it.medicine && /consult/i.test((it.description || '') + ''))
      if (isConsult) {
        doc.fontSize(11).text(`Consultation fees :-------  x${quantity} @ ${unitPrice.toFixed(2)}  GST ${gstRate}%  Line ${(line + gst).toFixed(2)}`)
      } else {
        const name = it.medicine?.name || it.description || 'Item'
        doc.fontSize(11).text(`${name}  x${quantity} @ ${unitPrice.toFixed(2)}  GST ${gstRate}%  Line ${(line + gst).toFixed(2)}`)
      }
    })
    doc.moveDown()
    const safeSubtotal = Number.isFinite(invoice.subtotal) ? invoice.subtotal : invoice.items.reduce((acc, it) => {
      const unitPrice = Number(it.unitPrice) || Number(it.medicine?.sellingPrice) || 0
      const quantity = Number(it.quantity) || 0
      return acc + (unitPrice * quantity)
    }, 0)
    const safeGstTotal = Number.isFinite(invoice.gstTotal) ? invoice.gstTotal : invoice.items.reduce((acc, it) => {
      const unitPrice = Number(it.unitPrice) || Number(it.medicine?.sellingPrice) || 0
      const quantity = Number(it.quantity) || 0
      const gstRate = Number(it.gstRate) || Number(it.medicine?.gstRate) || 0
      const line = unitPrice * quantity
      return acc + (line * (gstRate / 100))
    }, 0)
    const safeTotal = Number.isFinite(invoice.total) ? invoice.total : (safeSubtotal + safeGstTotal)
    doc.fontSize(12).text(`Subtotal: ${safeSubtotal.toFixed(2)}`)
    doc.text(`GST: ${safeGstTotal.toFixed(2)}`)
    doc.text(`Total: ${safeTotal.toFixed(2)}`)
    doc.end();

    const pdfBuffer = await pdfBufferPromise;
    const cldObj = await uploadToCloudinary(pdfBuffer, 'invoices', 'raw');
    invoice.pdfUrl = cldObj.secure_url;
    await invoice.save();
    console.log(`[invoicePdfHelper] Uploaded invoice PDF to Firebase Storage and saved URL: ${invoice.pdfUrl}`);
  } catch (err) {
    console.error(`[invoicePdfHelper] Failed to generate/upload invoice PDF for ID ${invoiceId}:`, err);
  }
}
