import 'dotenv/config'
import { db } from '../config/firebase.js'

async function migrateCollection(collectionName) {
  console.log(`\n--- Migrating collection: ${collectionName} ---`)
  const globalRef = db.collection(collectionName)
  const snapshot = await globalRef.get()
  
  if (snapshot.empty) {
    console.log(`Global collection ${collectionName} is empty.`)
    return
  }

  console.log(`Found ${snapshot.size} global documents in ${collectionName}.`)
  let copiedCount = 0
  let skippedCount = 0

  for (const doc of snapshot.docs) {
    const data = doc.data()
    // Identify tenantId. Some documents might have tenant or tenantId field.
    const tenantId = data.tenantId || data.tenant || null
    if (!tenantId) {
      skippedCount++
      continue
    }

    const tenantIdStr = String(tenantId)
    // Basic sanity check on tenantId length
    if (tenantIdStr.length < 5) {
      skippedCount++
      continue
    }

    // Reference in tenant subcollection: hospitals/{tenantId}/{collectionName}/{docId}
    const tenantDocRef = db.collection('hospitals').doc(tenantIdStr).collection(collectionName).doc(doc.id)
    const existsSnap = await tenantDocRef.get()
    
    if (!existsSnap.exists) {
      await tenantDocRef.set({
        ...data,
        createdAt: data.createdAt || new Date(),
        updatedAt: data.updatedAt || new Date()
      })
      copiedCount++
    } else {
      skippedCount++
    }
  }

  console.log(`Migration of ${collectionName} finished. Copied: ${copiedCount}, Skipped/Existing/NoTenant: ${skippedCount}`)
}

async function migrateBeds() {
  console.log(`\n--- Migrating collection: beds ---`)
  const globalBedsRef = db.collection('beds')
  const bedsSnap = await globalBedsRef.get()

  if (bedsSnap.empty) {
    console.log(`Global collection beds is empty.`)
    return
  }

  console.log(`Found ${bedsSnap.size} global beds.`)
  let copiedCount = 0
  let skippedCount = 0

  // We need to resolve tenantId via their parent ward.
  // Cache ward tenantIds to avoid redundant lookups.
  const wardTenantMap = {}

  for (const doc of bedsSnap.docs) {
    const bedData = doc.data()
    const wardId = String(bedData.ward || bedData.wardId || '')
    if (!wardId) {
      skippedCount++
      continue
    }

    let tenantId = wardTenantMap[wardId]
    if (tenantId === undefined) {
      // Look up ward globally
      let wardDoc = await db.collection('wards').doc(wardId).get()
      if (wardDoc.exists) {
        tenantId = wardDoc.data().tenantId || wardDoc.data().tenant || null
      } else {
        // Look up ward across all tenants (can be slow, but it's a migration, and we check if we can find it)
        // For simplicity, let's see if we can query collectionGroup 'wards'
        const wardsGroup = await db.collectionGroup('wards').get()
        const match = wardsGroup.docs.find(d => d.id === wardId)
        if (match) {
          tenantId = match.data().tenantId || match.data().tenant || match.ref.parent.parent.id
        } else {
          tenantId = null
        }
      }
      wardTenantMap[wardId] = tenantId
    }

    if (!tenantId) {
      skippedCount++
      continue
    }

    const tenantIdStr = String(tenantId)
    const tenantDocRef = db.collection('hospitals').doc(tenantIdStr).collection('beds').doc(doc.id)
    const existsSnap = await tenantDocRef.get()

    if (!existsSnap.exists) {
      await tenantDocRef.set({
        ...bedData,
        createdAt: bedData.createdAt || new Date(),
        updatedAt: bedData.updatedAt || new Date()
      })
      copiedCount++
    } else {
      skippedCount++
    }
  }

  console.log(`Migration of beds finished. Copied: ${copiedCount}, Skipped/Existing/NoTenant: ${skippedCount}`)
}

async function run() {
  try {
    await migrateCollection('invoices')
    await migrateCollection('paymentrequests')
    await migrateCollection('patients')
    await migrateCollection('wards')
    await migrateBeds()
    await migrateCollection('shifts')
    await migrateCollection('attendances')
    await migrateCollection('doctorattendances')
    await migrateCollection('prescriptions')
    console.log('\n✅ All SaaS migrations completed successfully!')
    process.exit(0)
  } catch (err) {
    console.error('Migration failed:', err)
    process.exit(1)
  }
}

run()
