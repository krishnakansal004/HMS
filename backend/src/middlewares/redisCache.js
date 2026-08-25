import Redis from "ioredis";
import { getRedisConnectionOptions } from "../queues/connection.js";

// Reusing existing Redis connection
const redisClient = new Redis(getRedisConnectionOptions());

export const cacheRoute = (ttlSeconds = 60) => {
  return async (req, res, next) => {
    // Only cache GET requests
    if (req.method !== "GET") return next();

    // Create a unique cache key based on the URL and the Tenant ID
    const cacheKey = `cache:${req.currentTenantId}:${req.originalUrl}`;

    try {
      const cachedResponse = await redisClient.get(cacheKey);
      if (cachedResponse) {
        // Cache HIT: Return immediately without touching the database
        res.setHeader("X-Cache", "HIT");
        return res.status(200).json(JSON.parse(cachedResponse));
      }

      // Cache MISS: Intercept the response, save it to Redis, then send it
      res.setHeader("X-Cache", "MISS");
      const originalJson = res.json;
      res.json = function (body) {
        // Only cache successful responses
        if (res.statusCode >= 200 && res.statusCode < 300) {
          redisClient.setex(cacheKey, ttlSeconds, JSON.stringify(body));
        }
        return originalJson.call(this, body);
      };
      next();
    } catch (err) {
      // If Redis fails, fallback to the database
      console.error("[Redis Cache Error]", err);
      next();
    }
  };
};

export const clearTenantCache = async (tenantId, prefix = "*") => {
  const keys = await redisClient.keys(`cache:${tenantId}:${prefix}`);
  if (keys.length > 0) await redisClient.del(keys);
};
