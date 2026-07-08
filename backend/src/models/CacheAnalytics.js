import FirestoreModel, { FirestoreDocument } from './firestore/FirestoreModel.js'

class CacheAnalyticsDocument extends FirestoreDocument {}

class CacheAnalyticsModel extends FirestoreModel {
  constructor() {
    super('cache_analytics')
  }
  _wrap(data) {
    if (!data) return null
    return new CacheAnalyticsDocument(this, data)
  }
}

export default new CacheAnalyticsModel()
