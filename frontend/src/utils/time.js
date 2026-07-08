export function todayStr() {
  // Use en-CA to get YYYY-MM-DD and force Asia/Kolkata timezone
  try {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
  } catch {
    // fallback
    const d = new Date()
    const off = d.getTimezoneOffset() * 60000
    const ist = new Date(d.getTime() + off + 5.5 * 60 * 60000)
    return ist.toISOString().slice(0, 10)
  }
}

export function istISOString(date = new Date()) {
  try {
    // Create string in IST with +05:30 offset
    const parts = new Date(date).toLocaleString('sv', { timeZone: 'Asia/Kolkata' }).replace(' ', 'T')
    // local 'sv' representation is like YYYY-MM-DDTHH:MM:SS
    return parts + '+05:30'
  } catch {
    const d = new Date(date)
    const utc = d.getTime() + (d.getTimezoneOffset() * 60000)
    const ist = new Date(utc + 5.5 * 60 * 60000)
    const pad = (n) => String(n).padStart(2, '0')
    return `${ist.getFullYear()}-${pad(ist.getMonth() + 1)}-${pad(ist.getDate())}T${pad(ist.getHours())}:${pad(ist.getMinutes())}:${pad(ist.getSeconds())}+05:30`
  }
}
