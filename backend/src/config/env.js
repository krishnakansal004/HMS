import dotenv from 'dotenv';

dotenv.config();

const requiredEnvVars = [
  'PORT',
  'NODE_ENV',
  'DATABASE_URL',
  'REDIS_URL',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
];

const validateEnv = () => {
  const missingVars = requiredEnvVars.filter((envVar) => !process.env[envVar]);

  if (missingVars.length > 0) {
    console.error(`[FATAL ERROR] Missing required environment variables: ${missingVars.join(', ')}`);
    process.exit(1);
  }
  if ((process.env.NODE_ENV || 'development') === 'production' && !process.env.ALLOWED_ORIGINS) {
    console.error('[FATAL ERROR] ALLOWED_ORIGINS must be set in production — comma-separated list of allowed frontend origins (e.g. https://app.yourhospital.com).');
    process.exit(1);
  }
};

validateEnv();

function resolveAllowedOrigins() {
  if (process.env.ALLOWED_ORIGINS) {
    return process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean);
  }
  return ['http://localhost:5173'];
}

export const env = {
  port: parseInt(process.env.PORT || '4000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL,
  redisUrl: process.env.REDIS_URL,
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  allowedOrigins: resolveAllowedOrigins(),
};