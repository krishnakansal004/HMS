import FirestoreModel, { FirestoreDocument } from './firestore/FirestoreModel.js'

class CacheStatisticsDocument extends FirestoreDocument {}

class CacheStatisticsModel extends FirestoreModel {
  constructor() {
    super('cache_statistics')
  }
  _wrap(data) {
    if (!data) return null
    return new CacheStatisticsDocument(this, data)
  }
}

export default new CacheStatisticsModel()
