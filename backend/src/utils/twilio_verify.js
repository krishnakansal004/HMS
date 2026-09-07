import 'dotenv/config'
import twilio from 'twilio'

const accountSid = process.env.TWILIO_ACCOUNT_SID
const authToken = process.env.TWILIO_AUTH_TOKEN
const apiKeySid = process.env.TWILIO_API_KEY_SID
const apiKeySecret = process.env.TWILIO_API_KEY_SECRET

if (!accountSid?.startsWith('AC')) {
  console.error('TWILIO_ACCOUNT_SID must be a Twilio Account SID beginning with AC')
  process.exit(2)
}

let client
if (authToken) {
  client = twilio(accountSid, authToken)
} else if (apiKeySid?.startsWith('SK') && apiKeySecret) {
  client = twilio(apiKeySid, apiKeySecret, { accountSid })
} else {
  console.error('Set TWILIO_AUTH_TOKEN or TWILIO_API_KEY_SID and TWILIO_API_KEY_SECRET')
  process.exit(2)
}

try {
  const account = await client.api.v2010.accounts(accountSid).fetch()
  console.log(JSON.stringify({
    ok: true,
    status: account.status,
    type: account.type,
    smsFromConfigured: Boolean(process.env.TWILIO_FROM),
    whatsappFromConfigured: Boolean(process.env.TWILIO_WHATSAPP_FROM)
  }))
} catch (error) {
  console.error(JSON.stringify({
    ok: false,
    status: error.status || null,
    code: error.code || null,
    message: error.message || 'Twilio verification failed'
  }))
  process.exit(1)
}