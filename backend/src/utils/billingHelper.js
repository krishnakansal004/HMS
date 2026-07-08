import Invoice from '../models/Invoice.js';
import Patient from '../models/Patient.js';

/**
 * Automatically post a clinical charge (e.g. Lab test, MRI scan, surgery fee) to the patient's billing profile.
 * It adds the item to an existing unpaid invoice or creates a new one.
 * @param {Object} req Express request object
 * @param {string} patientId Patient ID
 * @param {string} description Charge description (e.g., 'Blood Test: CBC')
 * @param {number} amount Cost of the service
 */
export async function postBillingCharge(req, patientId, description, amount) {
  try {
    const patient = await req.db(Patient).findById(patientId);
    if (!patient) {
      console.warn('[billingHelper] Patient not found, skipping charge posting.');
      return null;
    }

    const tenantId = req.tenant?._id || req.user?.tenantId || null;
    
    // Find an unpaid invoice for this patient
    let invoice = await req.db(Invoice).findOne({ patient: patientId, status: 'unpaid' });
    
    const invoiceItem = {
      description,
      quantity: 1,
      unitPrice: amount,
      gstRate: 0
    };

    if (invoice) {
      // Add to existing unpaid invoice
      const items = Array.isArray(invoice.items) ? invoice.items : [];
      items.push(invoiceItem);
      invoice.items = items;
      invoice.subtotal = (invoice.subtotal || 0) + amount;
      invoice.total = (invoice.total || 0) + amount;
      await invoice.save();
    } else {
      // Create new unpaid invoice
      invoice = req.db(Invoice)._wrap({
        patient: patientId,
        patientName: `${patient.firstName} ${patient.lastName}`,
        tenantId,
        items: [invoiceItem],
        subtotal: amount,
        gstTotal: 0,
        total: amount,
        status: 'unpaid',
        createdBy: req.userId || 'system',
        notes: 'Clinical service charge posted automatically'
      });
      await invoice.save();
    }
    console.log(`[billingHelper] Posted charge of ${amount} for ${description} to invoice ${invoice._id}`);
    return invoice;
  } catch (e) {
    console.error('[billingHelper] Failed to post charge:', e.message);
    return null;
  }
}

export default postBillingCharge;
