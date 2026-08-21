import FirestoreModel, { FirestoreDocument } from './firestore/FirestoreModel.js'
import { db } from '../config/firebase.js'

class InvoiceDocument extends FirestoreDocument {
  // Custom methods if needed
}

class InvoiceModel extends FirestoreModel {
  constructor() {
    super('invoices')
  }

  _wrap(data) {
    if (!data) return null
    return new InvoiceDocument(this, data)
  }

  async create(data) {
    const docData = { ...data }

    if (!docData.invoiceNumber) {
      const counterRef = db.collection('counters').doc('invoices')
      try {
        await db.runTransaction(async (t) => {
          const doc = await t.get(counterRef)
          let nextSeq = 1001
          if (doc.exists) {
            nextSeq = doc.data().seq + 1
          }
          t.set(counterRef, { seq: nextSeq }, { merge: true })
          docData.invoiceNumber = nextSeq
        })
      } catch (e) {
        console.error('Invoice sequence error', e)
        if (!docData.invoiceNumber) docData.invoiceNumber = Date.now()
      }
    }

    if (!docData.status) docData.status = 'pending'
    if (!docData.currency) docData.currency = 'INR'
    if (docData.paid === undefined) docData.paid = false
    if (docData.stockDeducted === undefined) docData.stockDeducted = false

    return super.create(docData)
  }
}

export default new InvoiceModel()
