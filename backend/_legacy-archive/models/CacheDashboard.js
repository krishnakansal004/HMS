import FirestoreModel, { FirestoreDocument } from './firestore/FirestoreModel.js'

class CacheDashboardDocument extends FirestoreDocument {}

class CacheDashboardModel extends FirestoreModel {
  constructor() {
    super('cache_dashboard')
  }
  _wrap(data) {
    if (!data) return null
    return new CacheDashboardDocument(this, data)
  }
}

export default new CacheDashboardModel()
