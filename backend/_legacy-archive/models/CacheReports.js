import FirestoreModel, { FirestoreDocument } from './firestore/FirestoreModel.js'

class CacheReportsDocument extends FirestoreDocument {}

class CacheReportsModel extends FirestoreModel {
  constructor() {
    super('cache_reports')
  }
  _wrap(data) {
    if (!data) return null
    return new CacheReportsDocument(this, data)
  }
}

export default new CacheReportsModel()
