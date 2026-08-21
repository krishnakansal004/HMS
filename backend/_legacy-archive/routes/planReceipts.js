import express from 'express'
import fs from 'fs'
import path from 'path'
import PlanReceipt from '../models/PlanReceipt.js'
import cloudinary from '../config/cloudinary.js'
import { protect, requireRoles } from '../utils/auth.js'
import { allowRolesWithSubadminFeature } from '../utils/permissions.js'
import https from 'https'
import http from 'http'

const router = express.Router()

// Director or admin: list all plan receipts
router.get('/', protect, allowRolesWithSubadminFeature(['director', 'admin', 'subadmin'], 'view_plan_receipts'), async (req, res) => {
  try {
    // Populate invoice.createdBy so director UI can show who initiated the purchase
    let query = {}

    // If not director, or if director has a tenantId (e.g. testing as tenant), restrict to that tenant
    // BUT director might want to see ALL receipts if they are acting as Super Admin.
    // If req.userRole === 'director' AND !req.tenantId, we show ALL (global view).
    // If req.tenantId is present, we MUST restrict to that tenant (for admins/doctors).

    // Plan receipts are now stored in the root collection with a tenantId field
    // to allow global visibility for directors while maintaining access for tenants.
    const list = await PlanReceipt.find(req.tenantId ? { ...query, tenantId: req.tenantId } : query)
      .sort({ createdAt: -1 })
      .populate('invoice')


    // Map to include an `initiatedBy` helper on each receipt for easier client consumption
    const mapped = (list || []).map(pr => {
      try {
        const out = pr.toObject ? pr.toObject() : { ...pr._doc }
        // Smart scale: if total is suspiciously small (likely Rupees), scale it to Paise
        if (out.total && out.total > 0 && out.total < 50000) {
           out.total = Math.round(out.total * 100)
        }
        const inv = pr.invoice || null
        if (inv) {
          const creator = inv.createdBy || null
          out.initiatedBy = creator ? { id: creator._id || creator.id, name: creator.name || '', email: creator.email || '', role: inv.createdByRole || (inv.createdBy && inv.createdBy.role) || '' } : null
        } else {
          out.initiatedBy = null
        }
        return out
      } catch (e) { return pr }
    })
    res.json(mapped)
  } catch (e) {
    console.error('[planReceipts] list error', e)
    res.status(500).json({ error: 'Failed to load' })
  }
})

// Download PDF for a plan receipt
router.get('/:id/pdf', protect, allowRolesWithSubadminFeature(['director', 'admin', 'subadmin'], 'view_plan_receipts'), async (req, res) => {
  try {
    const pr = await PlanReceipt.findById(req.params.id)
    if (!pr) return res.status(404).json({ error: 'Not found' })

    const filename = `receipt-${pr.invoiceNumber || pr._id}.pdf`

    // Helper to stream from a URL with redirect handling
    const streamFromUrl = (url, depth = 0) => {
      if (depth > 5) {
        console.error(`[planReceipts] Too many redirects for URL: ${url}`)
        return res.status(500).json({ error: 'Too many redirects' })
      }

      console.log(`[planReceipts] Streaming from URL (depth ${depth}): ${url.substring(0, 80)}...`)

      const requestOptions = {
        headers: {
          'Accept': 'application/pdf,application/octet-stream,*/*',
          'User-Agent': 'Mozilla/5.0 (HMS-Backend)'
        }
      }

      const client = url.startsWith('https') ? https : http
      
      client.get(url, requestOptions, (cldRes) => {
        // Handle Redirects (Cloudinary often redirects to specific CDN nodes)
        if (cldRes.statusCode >= 300 && cldRes.statusCode < 400 && cldRes.headers.location) {
          let nextUrl = cldRes.headers.location
          if (!nextUrl.startsWith('http')) {
            const parsedUrl = new URL(url)
            nextUrl = parsedUrl.origin + nextUrl
          }
          console.log(`[planReceipts] Following redirect (${cldRes.statusCode}) to: ${nextUrl.substring(0, 60)}...`);
          return streamFromUrl(nextUrl, depth + 1)
        }

        if (cldRes.statusCode === 200) {
          res.setHeader('Content-Type', 'application/pdf')
          res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
          return cldRes.pipe(res)
        } else {
          console.error(`[planReceipts] Upstream Error: Status ${cldRes.statusCode} for URL: ${url}`)
          // Log headers to see if Cloudinary is giving us hints (like WAF blocks)
          console.error(`[planReceipts] Upstream Headers:`, JSON.stringify(cldRes.headers))
          
          const status = [401, 403].includes(cldRes.statusCode) ? 502 : (cldRes.statusCode || 500)
          if (!res.headersSent) {
            return res.status(status).json({ 
              error: 'Could not fetch asset from Cloudinary', 
              upstreamStatus: cldRes.statusCode,
              message: `Cloudinary returned ${cldRes.statusCode}. The file might be protected or the link expired.`
            })
          }
        }
      }).on('error', (err) => {
        console.error('[planReceipts] Proxy stream error', err)
        if (!res.headersSent) res.status(500).json({ error: 'Error streaming PDF: ' + err.message })
      })
    }

    // Helper to extract Cloudinary metadata from URL
    const getCloudinaryMetadata = (url) => {
      try {
        const parts = url.split('/')
        const uploadIdx = parts.indexOf('upload')
        if (uploadIdx === -1) return null
        
        const resourceType = parts[uploadIdx - 1] // e.g. "image" or "raw"
        let startIdx = uploadIdx + 1
        // Skip versioning part (v12345...)
        if (parts[startIdx].startsWith('v') && !isNaN(parts[startIdx].substring(1))) {
          startIdx++
        }
        
        const publicIdWithExt = parts.slice(startIdx).join('/')
        const publicId = publicIdWithExt.replace(/\.[^/.]+$/, "") // remove .pdf, .png etc
        
        return { publicId, resourceType }
      } catch (e) { return null }
    }

    // If there's an associated invoice, generate the PDF directly, completely bypassing Cloudinary ACLs/Stream errors
    if (pr.invoice) {
        try {
            const Invoice = (await import('../models/Invoice.js')).default;
            const PDFDocument = (await import('pdfkit')).default;
            const invoiceModel = pr.tenantId ? Invoice.forHospital(pr.tenantId) : (req.tenantId ? Invoice.forHospital(req.tenantId) : Invoice);
            const invoice = await invoiceModel.findById(pr.invoice).populate('items.medicine');
            
            if (invoice) {
                const doc = new PDFDocument({ margin: 50 });
                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
                
                doc.pipe(res);

                doc.fontSize(18).text('Invoice', { align: 'center' });
                doc.moveDown(0.5);
                doc.fontSize(12).text(`Invoice Number: ${invoice.invoiceNumber || invoice._id}`);
                doc.text(`Date: ${new Date(invoice.createdAt).toLocaleString()}`);
                doc.text(`Customer: ${invoice.patientName}`);
                doc.moveDown();
                doc.fontSize(13).text('Items:');
                doc.moveDown(0.25);
                
                ;(invoice.items || []).forEach((it) => {
                    const unitPrice = Number(it.unitPrice) || 0;
                    const quantity = Number(it.quantity) || 0;
                    const gstRate = Number(it.gstRate) || 0;
                    const line = unitPrice * quantity;
                    const gst = line * (gstRate / 100);
                    const name = it.medicine?.name || it.description || 'Item';
                    doc.fontSize(11).text(
                        `${name}  x${quantity} @ ${unitPrice.toFixed(2)}  GST ${gstRate}%  Line ${(line + gst).toFixed(2)}`
                    );
                });
                
                doc.moveDown();
                const safeSubtotal = Number.isFinite(invoice.subtotal) ? invoice.subtotal : 0;
                const safeGstTotal = Number.isFinite(invoice.gstTotal) ? invoice.gstTotal : 0;
                const safeTotal = Number.isFinite(invoice.total) ? invoice.total : safeSubtotal + safeGstTotal;
                
                doc.fontSize(12).text(`Subtotal: ${safeSubtotal.toFixed(2)}`);
                doc.text(`GST: ${safeGstTotal.toFixed(2)}`);
                doc.text(`Total: ₹${safeTotal.toFixed(2)}`);
                
                if (invoice.paid && invoice.payment) {
                    doc.fontSize(11).text(`Payment Status: Paid (${invoice.payment.provider})`);
                    doc.text(`Transaction ID: ${invoice.payment.transactionId}`);
                    doc.text(`Date: ${new Date(invoice.payment.paidAt).toLocaleString()}`);
                }
                
                doc.end();
                return;
            }
        } catch (genErr) {
            console.error('[planReceipts] local PDF generation error:', genErr);
        }
    }

    // 1. Try Cloudinary URL via Proxy Stream (only if no invoice ref or generation failed)
    let targetUrl = pr.pdfUrl || pr.pdfPath || ''
    if (targetUrl && targetUrl.includes('cloudinary.com')) {
      console.log(`[planReceipts] Processing Cloudinary asset: ${targetUrl.substring(0, 60)}...`)
      
      const meta = getCloudinaryMetadata(targetUrl)
      if (meta) {
        try {
          const signedUrl = cloudinary.url(meta.publicId, {
            resource_type: meta.resourceType,
            sign_url: true,
            secure: true,
            type: 'upload' 
          })
          targetUrl = signedUrl
        } catch (e) {
          console.error('[planReceipts] Error signing Cloudinary URL', e)
        }
      }
      return streamFromUrl(targetUrl)
    }

    // 2. Fallback to Local file
    if (pr.pdfPath && !pr.pdfPath.startsWith('http')) {
      if (fs.existsSync(pr.pdfPath)) return res.download(path.resolve(pr.pdfPath), filename)
    }
    
    // 3. Last resort fallback for non-cloudinary URLs
    if (targetUrl && targetUrl.startsWith('http')) {
      return streamFromUrl(targetUrl)
    }

    return res.status(404).json({ error: 'PDF source not identified' })
  } catch (e) {
    console.error('[planReceipts] pdf error', e)
    res.status(500).json({ error: 'Failed to load PDF' })
  }
})

export default router
