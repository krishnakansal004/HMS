import FirestoreModel from './firestore/FirestoreModel.js'

class Expense extends FirestoreModel {
  constructor() {
    super('expenses')
  }

  // Schema:
  // title: string
  // category: string (Marketing, Salary, Rent, Infrastructure, etc.)
  // amount: number (Rupees)
  // date: string (ISO or Date)
  // description: string
  // createdBy: string (userId)
  // attachments: array of urls
}

export default new Expense()
