import FirestoreModel, { FirestoreDocument } from './firestore/FirestoreModel.js'

class CacheAttendanceDocument extends FirestoreDocument {}

class CacheAttendanceModel extends FirestoreModel {
  constructor() {
    super('cache_attendance')
  }
  _wrap(data) {
    if (!data) return null
    return new CacheAttendanceDocument(this, data)
  }
}

export default new CacheAttendanceModel()
