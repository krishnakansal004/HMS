import Redis from "ioredis";

export function getRedisConnectionOptions() {
  const redisUrl = process.env.REDIS_URL;
  if (redisUrl) {
    return redisUrl;
  }

  const restUrl = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (restUrl && token) {
    try {
      const host = restUrl
        .replace("https://", "")
        .replace("http://", "")
        .split(":")[0]
        .split("/")[0];
      return {
        host,
        port: 6379,
        username: "default",
        password: token,
        tls: {},
        maxRetriesPerRequest: null,
      };
    } catch (err) {
      console.error(
        "[RedisConnection] Failed to parse Upstash URL:",
        err.message,
      );
    }
  }

  return {
    host: process.env.REDIS_HOST || "127.0.0.1",
    port: Number(process.env.REDIS_PORT || 6379),
    maxRetriesPerRequest: null,
  };
}
