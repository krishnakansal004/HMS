import bcrypt from 'bcryptjs'
import User from '../models/User.js'

export async function ensureDefaultAdmin() {
  const name = process.env.ADMIN_NAME || 'Admin'
  const email = process.env.ADMIN_EMAIL || 'admin@hms.com'
  const password = process.env.ADMIN_PASSWORD || 'Admin@123'

  if (!email || !password) {
    throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD environment variables must be set')
  }

  const duplicate = await User.findOne({ email })
  if (duplicate) return null

  const passwordHash = await bcrypt.hash(password, 10)
  const user = await User.create({ name, email, passwordHash, role: 'director' })
  console.log('Created default director user:', { email })
  return user
}
