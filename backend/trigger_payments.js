import jwt from 'jsonwebtoken'
import fetch from 'node-fetch'
import dotenv from 'dotenv'

dotenv.config()

const secret = process.env.ACCESS_TOKEN_SECRET
const payload = {
  sub: '2UlWMhzrPqdmH9ZGToJR',
  sid: 'a742668b-3eec-450d-967a-538ce92e96d6',
  role: 'patient',
  tenantId: 'zN6mVN6PktDvZa69CNj3',
  type: 'access'
}

const token = jwt.sign(payload, secret, { expiresIn: '1d' })

async function run() {
  const body = {
    patientName: 'm',
    items: [
      {
        description: 'Consultation with Dr. Test',
        quantity: 1,
        unitPrice: 500
      }
    ],
    doctorId: 'Iaf2nyFyI8qSqmsbBcbY',
    doctorName: 'Test'
  }

  console.log('Sending request to backend...')
  try {
    const res = await fetch('http://localhost:4000/api/payments/razorpay/create-link', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(body)
    })
    console.log('Status:', res.status)
    const json = await res.json()
    console.log('Response:', json)
  } catch (e) {
    console.error('Fetch error:', e)
  }
}

run()
