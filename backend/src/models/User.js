import bcrypt from 'bcryptjs'
import FirestoreModel, { FirestoreDocument } from './firestore/FirestoreModel.js'

class UserDocument extends FirestoreDocument {
  async comparePassword(candidate) {
    if (!this.passwordHash) return false
    return bcrypt.compare(candidate, this.passwordHash)
  }

  toSafeJSON() {
    const safe = { ...this }
    delete safe.passwordHash
    delete safe._model
    delete safe.sessionId
    return safe
  }
}

class UserModel extends FirestoreModel {
  constructor() {
    super('users')
  }
  _wrap(data) {
    if (!data) return null
    return new UserDocument(this, data)
  }
}

export default new UserModel()
