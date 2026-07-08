import 'dotenv/config'
import cloudinary from './src/config/cloudinary.js'
import https from 'https'

const targetUrl = 'https://res.cloudinary.com/dt5vmndd3/image/upload/v1776714878/hms/plan-receipts/zsottlwvfgedlaxmfdi3.pdf'

const getCloudinaryMetadata = (url) => {
    try {
      const parts = url.split('/')
      const uploadIdx = parts.indexOf('upload')
      if (uploadIdx === -1) return null
      
      const resourceType = parts[uploadIdx - 1] // e.g. "image" or "raw"
      let startIdx = uploadIdx + 1
      // Skip versioning part (v12345...)
      if (parts[startIdx].startsWith('v') && !isNaN(parts[startIdx].substring(1))) {
        startIdx++
      }
      
      const publicIdWithExt = parts.slice(startIdx).join('/')
      const publicId = publicIdWithExt // Keep extension for PDF
      
      return { publicId, resourceType }
    } catch (e) { return null }
}

async function testSign() {
    const meta = getCloudinaryMetadata(targetUrl)
    console.log('Metadata:', meta)

    // Option 1: Signed Upload type
    const signedUrl = cloudinary.url(meta.publicId, {
        resource_type: meta.resourceType,
        sign_url: true,
        secure: true,
        type: 'upload' 
    })
    console.log('Signed URL (upload):', signedUrl)

    // Option 2: Authenticated type
    const authUrl = cloudinary.url(meta.publicId, {
        resource_type: meta.resourceType,
        sign_url: true,
        secure: true,
        type: 'authenticated'
    })
    console.log('Authenticated URL:', authUrl)

    // Try hitting signedUrl
    https.get(signedUrl, (res) => {
        console.log('Signed URL Status:', res.statusCode)
        console.log('Signed Headers:', res.headers['x-cld-error'])
    })

    // Try hitting authUrl
    https.get(authUrl, (res) => {
        console.log('Auth URL Status:', res.statusCode)
        console.log('Auth Headers:', res.headers['x-cld-error'])
    })
}

testSign()

