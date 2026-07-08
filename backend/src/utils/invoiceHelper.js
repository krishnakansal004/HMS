import admin, { db } from '../config/firebase.js'

export async function findInvoiceAcrossAllTenants(id) {
  try {
    // Try root collection first (for SaaS plans/subscriptions etc)
    const doc = await db.collection('invoices').doc(id).get()
    if (doc.exists) {
      return { data: doc.data(), tenantId: null, docRef: doc.ref }
    }
    
    // Try all hospitals dynamically using db.getAll
    const hospitalsSnapshot = await db.collection('hospitals').get()
    const refs = hospitalsSnapshot.docs.map(hDoc => 
      db.collection('hospitals').doc(hDoc.id).collection('invoices').doc(id)
    )
    if (refs.length > 0) {
      const docSnaps = await db.getAll(...refs)
      const matched = docSnaps.find(ds => ds.exists)
      if (matched) {
        const parentPath = matched.ref.path
        const parts = parentPath.split('/')
        const tenantId = parts[0] === 'hospitals' ? parts[1] : null
        return { data: matched.data(), tenantId, docRef: matched.ref }
      }
    }
  } catch (error) {
    console.error(`[invoiceHelper] Error finding invoice ${id} across all tenants:`, error)
  }
  return null
}

export async function findPaymentRequestAcrossAllTenants(id) {
  try {
    // Try root collection first
    const doc = await db.collection('paymentrequests').doc(id).get()
    if (doc.exists) {
      return { data: doc.data(), tenantId: null, docRef: doc.ref }
    }
    
    // Try all hospitals dynamically using db.getAll
    const hospitalsSnapshot = await db.collection('hospitals').get()
    const refs = hospitalsSnapshot.docs.map(hDoc => 
      db.collection('hospitals').doc(hDoc.id).collection('paymentrequests').doc(id)
    )
    if (refs.length > 0) {
      const docSnaps = await db.getAll(...refs)
      const matched = docSnaps.find(ds => ds.exists)
      if (matched) {
        const parentPath = matched.ref.path
        const parts = parentPath.split('/')
        const tenantId = parts[0] === 'hospitals' ? parts[1] : null
        return { data: matched.data(), tenantId, docRef: matched.ref }
      }
    }
  } catch (error) {
    console.error(`[invoiceHelper] Error finding payment request ${id} across all tenants:`, error)
  }
  return null
}

export async function findPaymentRequestByLinkIdAcrossAllTenants(linkId) {
  try {
    // Try root collection first
    const snapshotRoot = await db.collection('paymentrequests').where('razorpay.linkId', '==', linkId).limit(1).get()
    if (!snapshotRoot.empty) {
      const doc = snapshotRoot.docs[0]
      return { data: doc.data(), tenantId: null, docRef: doc.ref }
    }
    
    // Try collection group query
    const snapshot = await db.collectionGroup('paymentrequests').where('razorpay.linkId', '==', linkId).limit(1).get()
    if (!snapshot.empty) {
      const matchedDoc = snapshot.docs[0]
      const parentPath = matchedDoc.ref.path
      const parts = parentPath.split('/')
      const tenantId = parts[0] === 'hospitals' ? parts[1] : null
      return { data: matchedDoc.data(), tenantId, docRef: matchedDoc.ref }
    }
  } catch (error) {
    console.error(`[invoiceHelper] Error finding payment request by linkId ${linkId} across all tenants:`, error)
  }
  return null
}
