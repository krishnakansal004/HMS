import { Redis } from '@upstash/redis'

let redisClient = null

// Initialize Upstash Redis client if credentials are provided
if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  try {
    redisClient = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
    console.log('[Redis] Serverless Redis client initialized (Upstash)')
  } catch (err) {
    console.error('[Redis] Failed to initialize Upstash Redis client:', err.message)
  }
} else {
  console.log('[Redis] Credentials missing. Falling back to Firestore Cache.')
}

const fallbackCache = new Map()

/**
 * Get item from Redis cache
 * @param {string} key 
 * @returns {Promise<any|null>}
 */
export async function getCache(key) {
  if (!redisClient) {
    const cached = fallbackCache.get(key)
    if (cached) {
      if (Date.now() - cached.timestamp < cached.ttlMs) {
        return JSON.parse(JSON.stringify(cached.value))
      }
      fallbackCache.delete(key) // Clean up expired
    }
    return null
  }
  try {
    const val = await redisClient.get(key)
    if (val === undefined || val === null) return null
    if (typeof val === 'string') {
      try {
        return JSON.parse(val)
      } catch (e) {
        return val
      }
    }
    return val
  } catch (err) {
    console.error(`[Redis] Error getting key ${key}:`, err.message)
    return null
  }
}

/**
 * Set item in Redis cache with an optional TTL
 * @param {string} key 
 * @param {any} value 
 * @param {number} [ttlSeconds] 
 * @returns {Promise<boolean>}
 */
export async function setCache(key, value, ttlSeconds) {
  if (!redisClient) {
    fallbackCache.set(key, {
      value: JSON.parse(JSON.stringify(value)),
      timestamp: Date.now(),
      ttlMs: (ttlSeconds || 300) * 1000
    })
    return true
  }
  try {
    const serialized = typeof value === 'object' ? JSON.stringify(value) : value
    if (ttlSeconds) {
      await redisClient.set(key, serialized, { ex: ttlSeconds })
    } else {
      await redisClient.set(key, serialized)
    }
    return true
  } catch (err) {
    console.error(`[Redis] Error setting key ${key}:`, err.message)
    return false
  }
}

/**
 * Delete item from Redis cache
 * @param {string} key 
 * @returns {Promise<boolean>}
 */
export async function delCache(key) {
  if (!redisClient) {
    fallbackCache.delete(key)
    return true
  }
  try {
    await redisClient.del(key)
    return true
  } catch (err) {
    console.error(`[Redis] Error deleting key ${key}:`, err.message)
    return false
  }
}

/**
 * Delete keys matching pattern from Redis cache
 * @param {string} pattern 
 * @returns {Promise<boolean>}
 */
export async function delCachePattern(pattern) {
  if (!redisClient) {
    const regex = new RegExp('^' + pattern.split('*').map(s => s.replace(/[.+^${}()|[\]\\]/g, '\\$&')).join('.*') + '$')
    for (const key of fallbackCache.keys()) {
      if (regex.test(key)) {
        fallbackCache.delete(key)
      }
    }
    return true
  }
  try {
    const keys = await redisClient.keys(pattern)
    if (keys && keys.length > 0) {
      await redisClient.del(...keys)
    }
    return true
  } catch (err) {
    console.error(`[Redis] Error deleting pattern ${pattern}:`, err.message)
    return false
  }
}

export default {
  getCache,
  setCache,
  delCache,
  delCachePattern
}
