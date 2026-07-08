import FirestoreModel, { FirestoreDocument } from './firestore/FirestoreModel.js'

class EmailJobDocument extends FirestoreDocument { }

class EmailJobModel extends FirestoreModel {
  constructor() {
    super('emailjobs')
  }

  _wrap(data) {
    if (!data) return null
    return new EmailJobDocument(this, data)
  }

  async create(data) {
    const now = new Date()
    const payload = {
      kind: data?.kind || 'credentials',
      status: data?.status || 'pending',
      attempts: Number(data?.attempts || 0),
      maxAttempts: Number(data?.maxAttempts || Number(process.env.EMAIL_JOB_MAX_ATTEMPTS || 8)),
      nextAttemptAt: data?.nextAttemptAt || now,
      lockedAt: data?.lockedAt || null,
      lastError: data?.lastError || '',
      createdAt: data?.createdAt || now,
      updatedAt: now,
      ...data
    }
    return super.create(payload)
  }
}

export default new EmailJobModel()

