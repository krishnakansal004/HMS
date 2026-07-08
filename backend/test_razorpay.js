import Razorpay from 'razorpay'
import dotenv from 'dotenv'

dotenv.config()

console.log('Using Key ID:', process.env.RAZORPAY_KEY_ID)

const instance = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_dummy',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'dummy_secret'
})

const options = {
  amount: 50000, // Rs 500
  currency: 'INR',
  description: `Test Booking Fee`,
  reference_id: 'test_ref_' + Date.now(),
  customer: { name: 'Test Patient', contact: null, email: null },
  callback_url: 'http://localhost:5173/?payment_redirect=true',
  callback_method: 'get'
}

instance.paymentLink.create(options)
  .then(res => {
    console.log('Success:', res)
  })
  .catch(err => {
    console.error('Error details:', err)
  })
