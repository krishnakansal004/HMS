import { db } from '../../config/firebase.js'
import admin from 'firebase-admin'
import { addDbQueryTime } from '../../utils/telemetry.js'
import { getCache, setCache } from '../../utils/redis.js'

const localCache = new Map()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

class FirestoreDocument {
    constructor(model, data) {
        Object.defineProperty(this, '_model', { value: model, writable: true, configurable: true, enumerable: false })
        Object.assign(this, data)
    }

    async save() {
        if (this._id) {
            const data = { ...this }
            Object.keys(data).forEach(key => data[key] === undefined && delete data[key])
            const updated = await this._model.update(this._id, data)
            Object.assign(this, updated)
            return this
        } else {
            const newDoc = await this._model.create(this)
            Object.assign(this, newDoc)
            return this
        }
    }

    toObject() {
        return { ...this }
    }
}

class FirestoreQuery {
    constructor(model, query = {}, single = false) {
        this.model = model
        this.query = query
        this.single = single
        this.sortFields = {}
        this.populateFields = []
        this.selectFields = null
        this.limitVal = null
        this.skipVal = null
        this.selectFields = null
        this.limitVal = null
        this.skipVal = null
        this.docId = null // For findById support
        this.forceEmpty = false // Safety for empty $in
    }

    where(key, op, val) {
        if (val === undefined) {
            val = op; op = '=='
        }
        if (!this.query[key]) this.query[key] = {}
        // Internal representation of operators
        // Simplification for now
        return this
    }

    sort(opts) {
        this.sortFields = opts
        return this
    }

    populate(path, select) {
        // Handle space separated select string
        this.populateFields.push({ path, select })
        return this
    }

    select(fields) {
        this.selectFields = fields
        return this
    }

    limit(val) {
        this.limitVal = val
        return this
    }

    skip(val) {
        this.skipVal = val
        return this
    }

    async count() {
        let ref = this.model.collection
        for (const key in this.query) {
            const val = this.query[key]
            const isOperatorObject = typeof val === 'object' && val !== null && !Array.isArray(val) && Object.keys(val).some(k => k.startsWith('$'))
            if (isOperatorObject) {
                if (val.$eq !== undefined) ref = ref.where(key, '==', val.$eq)
                if (val.$gt !== undefined) ref = ref.where(key, '>', val.$gt)
                if (val.$gte !== undefined) ref = ref.where(key, '>=', val.$gte)
                if (val.$lt !== undefined) ref = ref.where(key, '<', val.$lt)
                if (val.$lte !== undefined) ref = ref.where(key, '<=', val.$lte)
                if (val.$ne !== undefined) ref = ref.where(key, '!=', val.$ne)
                if (val.$in !== undefined) ref = ref.where(key, 'in', val.$in)
                if (val.$nin !== undefined) ref = ref.where(key, 'not-in', val.$nin)
            } else {
                ref = ref.where(key, '==', val)
            }
        }
        const queryStartTime = Date.now()
        const snapshot = await ref.count().get()
        const queryDuration = Date.now() - queryStartTime
        addDbQueryTime(queryDuration)
        if (queryDuration > 100) {
            console.warn(`[SLOW QUERY ALERT] ${this.model.collectionName} count query took ${queryDuration}ms. Query:`, JSON.stringify(this.query))
        }
        return snapshot.data().count
    }

    // Execute the query
    // Execute the query
    async then(resolve, reject) {
        // --- 1. LOCAL IN-MEMORY CACHE FOR STATIC & HOT COLLECTIONS (User, Tenant, Plan findById) ---
        const cacheableCollections = ['users', 'tenants', 'plans']
        const isCacheable = cacheableCollections.includes(this.model.collectionName)
        const cacheKey = isCacheable && this.docId ? `${this.model.collectionName}:${this.docId}` : null

        let cachedData = null
        if (cacheKey) {
            const cached = localCache.get(cacheKey)
            if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
                cachedData = cached.data
            } else {
                try {
                    const redisVal = await getCache(`hms:doc:${cacheKey}`)
                    if (redisVal) {
                        cachedData = redisVal
                        localCache.set(cacheKey, {
                            data: redisVal,
                            timestamp: Date.now()
                        })
                    }
                } catch (e) {
                    console.warn(`[Redis] getCache error for key hms:doc:${cacheKey}:`, e.message)
                }
            }
        }

        // If we have cached data and no populate fields, resolve immediately!
        if (cachedData && this.populateFields.length === 0) {
            const wrapped = this.model._wrap(cachedData)
            resolve(this.single ? wrapped : [wrapped])
            return
        }

        let ref = this.model.collection
        // Apply Filters (Simple equality)
        // Complex filters are hard to map 1:1 without a full parser
        for (const key in this.query) {
            const val = this.query[key]
            const mappedKey = (key === '_id' || key === 'id') ? admin.firestore.FieldPath.documentId() : key

            const isOperatorObject = typeof val === 'object' && val !== null && !Array.isArray(val) && Object.keys(val).some(k => k.startsWith('$'))
            if (isOperatorObject) {
                // Handle special Mongoose operators
                if (val.$eq !== undefined) ref = ref.where(mappedKey, '==', val.$eq)
                if (val.$gt !== undefined) ref = ref.where(mappedKey, '>', val.$gt)
                if (val.$gte !== undefined) ref = ref.where(mappedKey, '>=', val.$gte)
                if (val.$lt !== undefined) ref = ref.where(mappedKey, '<', val.$lt)
                if (val.$lte !== undefined) ref = ref.where(mappedKey, '<=', val.$lte)
                if (val.$ne !== undefined) ref = ref.where(mappedKey, '!=', val.$ne)
                if (val.$in !== undefined) {
                    if (Array.isArray(val.$in) && val.$in.length > 0) {
                        ref = ref.where(mappedKey, 'in', val.$in)
                    } else {
                        this.forceEmpty = true
                    }
                }
                if (val.$nin !== undefined) {
                    if (Array.isArray(val.$nin) && val.$nin.length > 0) {
                        ref = ref.where(mappedKey, 'not-in', val.$nin)
                    }
                }
            } else if (key === '$or' || key === '$and') {
                // Skip complex logic for now to avoid crash, but log it
                console.warn(`[FirestoreModel] Complex operator ${key} is not fully supported in this wrapper yet. skipping...`)
            } else {
                ref = ref.where(mappedKey, '==', val)
            }
        }

        const hasSort = Object.keys(this.sortFields).length > 0
        let sortedRef = ref
        if (hasSort) {
            for (const key in this.sortFields) {
                const dir = this.sortFields[key] === -1 ? 'desc' : 'asc'
                sortedRef = sortedRef.orderBy(key, dir)
            }
        }

        if (this.limitVal) sortedRef = sortedRef.limit(this.limitVal)
        if (this.skipVal) sortedRef = sortedRef.offset(this.skipVal)

        const execute = async (currentRef) => {
            let results = []
            if (this.forceEmpty) {
                results = []
            } else if (this.docId) {
                const doc = await this.model.collection.doc(this.docId).get()
                if (doc.exists) results = [this.model._docToObj(doc)]
            } else if (this.single) {
                const snapshot = await currentRef.limit(1).get()
                if (!snapshot.empty) results = [this.model._docToObj(snapshot.docs[0])]
            } else {
                const snapshot = await currentRef.get()
                results = snapshot.docs.map(d => this.model._docToObj(d))
            }
            return results
        }

        const queryStartTime = Date.now()

        try {
            let results = []
            let cacheHit = false

            if (cachedData) {
                // Deep clone cached data to prevent mutating the cache directly when populating
                results = [JSON.parse(JSON.stringify(cachedData))]
                cacheHit = true
            } else {
                results = await execute(sortedRef)
                const queryEndTime = Date.now()
                const queryDuration = queryEndTime - queryStartTime
                
                // Log to telemetry
                addDbQueryTime(queryDuration)

                // Slow Query Warning
                if (queryDuration > 100) {
                    console.warn(`[SLOW QUERY ALERT] ${this.model.collectionName} query took ${queryDuration}ms. Query:`, JSON.stringify(this.query), `docId:`, this.docId)
                }

                // Cache single doc results
                if (cacheKey && results.length > 0) {
                    const docData = results[0]
                    localCache.set(cacheKey, {
                        data: docData,
                        timestamp: Date.now()
                    })
                    await setCache(`hms:doc:${cacheKey}`, docData, 300).catch(err => {
                        console.warn(`[Redis] Error setting key hms:doc:${cacheKey}:`, err.message)
                    })
                }
            }

            // POPULATE (Manual Join in parallel using Promise.all)
            if (this.populateFields.length > 0 && results.length > 0) {
                await Promise.all(this.populateFields.map(async (pop) => {
                    const popPath = typeof pop.path === 'object' && pop.path !== null ? pop.path.path : pop.path

                    let collection = 'users'
                    const pathLower = popPath.toLowerCase()
                    const lastSegment = pathLower.split('.').pop()

                    if (lastSegment.includes('patient')) collection = 'patients'
                    else if (lastSegment.includes('invoice')) collection = 'invoices'
                    else if (lastSegment.includes('tenant')) collection = 'tenants'
                    else if (lastSegment.includes('plan')) collection = 'plans'
                    else if (lastSegment.includes('supplier')) collection = 'suppliers'
                    else if (lastSegment.includes('medicine')) collection = 'medicines'
                    else if (lastSegment.includes('doctor')) collection = 'users'
                    else if (lastSegment.includes('nurse')) collection = 'users'
                    else if (lastSegment === 'staff' || lastSegment.includes('staff')) collection = 'staffs'
                    else if (lastSegment.includes('event')) collection = 'events'
                    else if (lastSegment.includes('appointment')) collection = 'appointments'
                    else if (lastSegment.includes('prescription')) collection = 'prescriptions'
                    else if (pathLower.includes('doctor')) collection = 'users'
                    else if (pathLower.includes('staff')) collection = 'staffs'

                    const isNested = popPath.includes('.')
                    const [parent, child] = isNested ? popPath.split('.') : [popPath, null]

                    const ids = new Set()
                    results.forEach(d => {
                        if (isNested) {
                            const val = d[parent]
                            if (Array.isArray(val)) {
                                val.forEach(v => {
                                    const raw = v[child]
                                    const id = (raw && typeof raw === 'object' && raw._id) ? String(raw._id) : (raw ? String(raw) : null)
                                    if (id && id !== 'undefined' && id !== 'null' && id !== '[object Object]') ids.add(id)
                                })
                            } else if (val && typeof val === 'object') {
                                const raw = val[child]
                                const id = (raw && typeof raw === 'object' && raw._id) ? String(raw._id) : (raw ? String(raw) : null)
                                // Handle single object child mapping
                                if (id && id !== 'undefined' && id !== 'null' && id !== '[object Object]') ids.add(id)
                            }
                        } else {
                            const raw = d[popPath]
                            const id = (raw && typeof raw === 'object' && raw._id) ? String(raw._id) : (raw ? String(raw) : null)
                            if (id && id !== 'undefined' && id !== 'null' && id !== '[object Object]') ids.add(id)
                        }
                    })

                    if (ids.size > 0) {
                        const idArray = Array.from(ids)
                        
                        const docsMap = {}
                        const idsToFetch = []
                        const isCollectionCacheable = cacheableCollections.includes(collection)

                        await Promise.all(idArray.map(async (id) => {
                            if (isCollectionCacheable) {
                                const popCacheKey = `${collection}:${id}`
                                const cachedPop = localCache.get(popCacheKey)
                                if (cachedPop && (Date.now() - cachedPop.timestamp < CACHE_TTL)) {
                                    docsMap[id] = JSON.parse(JSON.stringify(cachedPop.data))
                                    return
                                }
                                try {
                                    const redisPop = await getCache(`hms:doc:${popCacheKey}`)
                                    if (redisPop) {
                                        docsMap[id] = redisPop
                                        localCache.set(popCacheKey, {
                                            data: redisPop,
                                            timestamp: Date.now()
                                        })
                                        return
                                    }
                                } catch (e) {
                                    console.warn(`[Redis] getCache error for popCacheKey ${popCacheKey}:`, e.message)
                                }
                            }
                            idsToFetch.push(id)
                        }))

                        if (idsToFetch.length > 0) {
                            const refs = idsToFetch.map(id => {
                                if (this.model.hospitalId && collection !== 'hospitals' && collection !== 'tenants' && collection !== 'users' && collection !== 'plans') {
                                    return db.collection('hospitals').doc(this.model.hospitalId).collection(collection).doc(id)
                                }
                                return db.collection(collection).doc(id)
                            })
                            const docSnaps = await db.getAll(...refs)
                            
                            for (const ds of docSnaps) {
                                if (ds.exists) {
                                    const data = ds.data()
                                    for (const k in data) {
                                        if (data[k] && typeof data[k].toDate === 'function') data[k] = data[k].toDate()
                                    }
                                    const docData = { _id: ds.id, ...data }
                                    docsMap[ds.id] = docData
                                    
                                    if (isCollectionCacheable) {
                                        localCache.set(`${collection}:${ds.id}`, {
                                            data: docData,
                                            timestamp: Date.now()
                                        })
                                        await setCache(`hms:doc:${collection}:${ds.id}`, docData, 300).catch(err => {
                                            console.warn(`[Redis] Error setting pop key hms:doc:${collection}:${ds.id}:`, err.message)
                                        })
                                    }
                                }
                            }
                        }

                        results.forEach(d => {
                            if (isNested) {
                                const val = d[parent]
                                if (Array.isArray(val)) {
                                    val.forEach(v => {
                                        const raw = v[child]
                                        const id = (raw && typeof raw === 'object' && raw._id) ? String(raw._id) : (raw ? String(raw) : null)
                                        if (docsMap[id]) v[child] = docsMap[id]
                                    })
                                } else if (val && typeof val === 'object') {
                                    const raw = val[child]
                                    const id = (raw && typeof raw === 'object' && raw._id) ? String(raw._id) : (raw ? String(raw) : null)
                                    if (docsMap[id]) val[child] = docsMap[id]
                                    else if (id && docsMap[id]) val[child] = docsMap[id]
                                }
                            } else {
                                const raw = d[popPath]
                                const id = (raw && typeof raw === 'object' && raw._id) ? String(raw._id) : (raw ? String(raw) : null)
                                if (docsMap[id]) d[popPath] = docsMap[id]
                            }
                        })
                    }
                }))
            }

            // Wrap results
            results = results.map(d => this.model._wrap(d))

            if (this.single) resolve(results.length ? results[0] : null)
            else resolve(results)
        } catch (e) {
            // Check if error is due to missing index
            const isIndexError = e.message.includes('FAILED_PRECONDITION') || e.message.includes('index')
            if (isIndexError && hasSort) {
                console.warn(`[FirestoreQuery] Missing index for ${this.model.collectionName}. Retrying without sort. Error: ${e.message}`)
                
                // Retry without sort
                const retryRef = this.limitVal ? ref.limit(this.limitVal) : ref
                const retryFinalRef = this.skipVal ? retryRef.offset(this.skipVal) : retryRef
                try {
                    let results = await execute(retryFinalRef)
                    results = results.map(d => this.model._wrap(d))
                    if (this.single) resolve(results.length ? results[0] : null)
                    else resolve(results)
                    return
                } catch (retryErr) {
                    e = retryErr // fallback to final error
                }
            }

            console.error(`[FirestoreQuery] execution failed for ${this.model.collectionName}:`, e)
            reject(e)
        }
    }

    // Catch-all for other promise methods
    async catch(rejectFn) {
        try {
            return await this;
        } catch (e) {
            return rejectFn(e);
        }
    }

    exec() {
        return this;
    }
}


class FirestoreModel {
    constructor(collectionName, hospitalId = null) {
        this.collectionName = collectionName
        this.hospitalId = hospitalId
        
        if (hospitalId && collectionName !== 'hospitals' && collectionName !== 'tenants') {
            this.collection = db.collection('hospitals').doc(hospitalId).collection(collectionName)
        } else {
            // Keep backwards compatibility for un-scoped access
            this.collection = db.collection(collectionName)
        }
    }

    forHospital(hospitalId) {
        if (!hospitalId) return this
        return new FirestoreModel(this.collectionName, hospitalId)
    }

    _wrap(data) {
        if (!data) return null
        return new FirestoreDocument(this, data)
    }

    _transformFirestoreData(data) {
        if (!data || typeof data !== 'object') return data

        // Handle DocumentReference
        if (data.constructor && data.constructor.name === 'DocumentReference') return data.id
        if (typeof data.getPath === 'function' && data.id) return data.id

        // Handle Timestamp
        if (typeof data.toDate === 'function') return data.toDate()

        // Don't recurse if it's already a Date (from toDate call)
        if (data instanceof Date) return data

        if (Array.isArray(data)) return data.map(v => this._transformFirestoreData(v))

        // IMPORTANT: Avoid recursing into complex instances (e.g. Firebase Internal objects)
        const proto = Object.getPrototypeOf(data)
        if (proto !== null && proto !== Object.prototype) return data

        const converted = {}
        for (const key in data) {
            converted[key] = this._transformFirestoreData(data[key])
        }
        return converted
    }

    _docToObj(doc) {
        if (!doc.exists) return null
        const data = this._transformFirestoreData(doc.data())
        return {
            _id: doc.id,
            id: doc.id,
            ...data
        }
    }

    async create(data) {
        const now = new Date()
        const cleanData = {
            ...data,
            createdAt: data.createdAt || now,
            updatedAt: now
        }
        delete cleanData._id
        delete cleanData.id
        Object.keys(cleanData).forEach(key => cleanData[key] === undefined && delete cleanData[key])
        const ref = await this.collection.add(cleanData)
        return this._wrap({ _id: ref.id, id: ref.id, ...cleanData })
    }

    async update(id, data) {
        if (!id) throw new Error('Update requires ID')
        const now = new Date()
        const updateData = { ...data, updatedAt: now }
        delete updateData._id
        delete updateData.id
        Object.keys(updateData).forEach(key => updateData[key] === undefined && delete updateData[key])
        await this.collection.doc(id).update(updateData)
        return this.findById(id)
    }

    findById(id) {
        // Return a Query to allow chaining .populate()
        // await Model.findById(id) will work because Query is thenable
        const q = new FirestoreQuery(this, {}, true)
        if (id) q.docId = id
        else q.docId = '___INVALID_ID___' // force empty result if no ID
        return q
    }

    // Return Query Object
    find(query = {}) {
        return new FirestoreQuery(this, query, false)
    }

    findOne(query = {}) {
        return new FirestoreQuery(this, query, true)
    }

    async countDocuments(query = {}) {
        return this.find(query).count()
    }

    async delete(id) {
        await this.collection.doc(id).delete()
        return true
    }

    async deleteOne(queryOrId) {
        if (typeof queryOrId === 'string') return this.delete(queryOrId)
        if (queryOrId && typeof queryOrId === 'object') {
            const id = queryOrId._id || queryOrId.id
            if (id) return this.delete(id)
            // If it's a generic query, find first and delete
            const docs = await this.find(queryOrId).limit(1)
            if (docs && docs.length > 0) {
                return this.delete(docs[0]._id || docs[0].id)
            }
        }
        return false
    }

    async deleteMany(query = {}) {
        let count = 0
        try {
            // Safety measure to prevent accidental wipes:
            const keys = Object.keys(query)
            if (keys.length === 0) {
                throw new Error(`[FirestoreModel] deleteMany must include a valid query, empty queries are blocked to prevent wiping the collection: ${this.collectionName}.`)
            }
            if (keys.some(k => k.startsWith('$') && k !== '$or' && k !== '$and')) {
                 // allow $or / $and if they are at top level, but $lt/gt etc are handled in FirestoreQuery
            }

            // we use the existing find() -> FirestoreQuery abstraction
            const docs = await this.find(query)
            if (Array.isArray(docs)) {
                // Batch deletes in chunks of 500 (Firestore limit)
                const MAX_BATCH_SIZE = 500
                for (let i = 0; i < docs.length; i += MAX_BATCH_SIZE) {
                    const chunk = docs.slice(i, i + MAX_BATCH_SIZE)
                    const batch = db.batch()
                    chunk.forEach(doc => {
                        const id = doc.id || doc._id
                        if (id) {
                            batch.delete(this.collection.doc(id))
                            count++
                        }
                    })
                    await batch.commit()
                }
            }
        } catch (e) {
            console.error(`[FirestoreModel] deleteMany error for ${this.collectionName}:`, e)
            throw e
        }
        return { deletedCount: count }
    }

    async updateMany(query = {}, update = {}) {
        let count = 0
        try {
            const docs = await this.find(query)
            if (Array.isArray(docs) && docs.length > 0) {
                const MAX_BATCH_SIZE = 500
                for (let i = 0; i < docs.length; i += MAX_BATCH_SIZE) {
                    const chunk = docs.slice(i, i + MAX_BATCH_SIZE)
                    const batch = db.batch()
                    chunk.forEach(doc => {
                        const id = doc.id || doc._id
                        if (id) {
                            const data = {}
                            // Basic $set support
                            if (update.$set) Object.assign(data, update.$set)
                            else {
                                // If no $set, treat the whole update object as fields (except $unset)
                                for (const k in update) {
                                    if (!k.startsWith('$')) data[k] = update[k]
                                }
                            }
                            // Basic $unset support
                            if (update.$unset) {
                                for (const k in update.$unset) data[k] = admin.firestore.FieldValue.delete()
                            }
                            
                            if (Object.keys(data).length > 0) {
                                batch.update(this.collection.doc(id), { ...data, updatedAt: new Date() })
                                count++
                            }
                        }
                    })
                    await batch.commit()
                }
            }
        } catch (e) {
            console.error(`[FirestoreModel] updateMany error for ${this.collectionName}:`, e)
            throw e
        }
        return { nModified: count, n: count, ok: 1 }
    }
}

export { FirestoreDocument, FirestoreQuery }
export default FirestoreModel
