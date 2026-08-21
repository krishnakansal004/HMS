import FirestoreModel, { FirestoreDocument } from './firestore/FirestoreModel.js'

class AppointmentDocument extends FirestoreDocument {}

class AppointmentModel extends FirestoreModel {
  constructor() {
    super('appointments')
  }
  _wrap(data) {
    if (!data) return null
    return new AppointmentDocument(this, data)
  }
}

export default new AppointmentModel()
