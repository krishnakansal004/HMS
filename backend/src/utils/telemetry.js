import { AsyncLocalStorage } from 'async_hooks'
import { performance } from 'perf_hooks'

export const telemetryStore = new AsyncLocalStorage()

export function getTelemetry() {
  return telemetryStore.getStore()
}

export function addDbQueryTime(ms) {
  const store = getTelemetry()
  if (store) {
    store.dbTime += ms
    store.queryCount += 1
  }
}

export function telemetryMiddleware(req, res, next) {
  const store = {
    dbTime: 0,
    queryCount: 0,
    serializationTime: 0,
    startTime: Date.now()
  }

  // Intercept res.json to capture serialization timing
  const originalJson = res.json
  res.json = function(body) {
    const startSerial = performance.now()
    // Trigger JSON serialization to measure timing
    const jsonStr = JSON.stringify(body)
    const serialTime = performance.now() - startSerial

    const totalTime = Date.now() - store.startTime
    const dbTime = Math.round(store.dbTime)
    const serializationTime = Number(serialTime.toFixed(2))
    const processingTime = Number((totalTime - dbTime - serializationTime).toFixed(2))

    console.log(`[TELEMETRY] ${req.method} ${req.originalUrl || req.url} | Status: ${res.statusCode} | Total: ${totalTime}ms | DB: ${dbTime}ms | Process: ${processingTime}ms | Serial: ${serializationTime}ms | Queries: ${store.queryCount}`)

    res.setHeader('X-Response-Time', `${totalTime}ms`)
    res.setHeader('X-DB-Time', `${dbTime}ms`)
    res.setHeader('X-Process-Time', `${processingTime}ms`)
    res.setHeader('X-Serialization-Time', `${serializationTime}ms`)

    return originalJson.call(this, body)
  }

  telemetryStore.run(store, () => {
    next()
  })
}

export default {
  telemetryStore,
  getTelemetry,
  addDbQueryTime,
  telemetryMiddleware
}
