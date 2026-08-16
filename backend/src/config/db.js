// src/config/db.js
import pkg from 'pg';
const { Pool } = pkg;
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Prisma } from '@prisma/client';
import { AsyncLocalStorage } from 'async_hooks';
import dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ DATABASE_URL is not defined in environment variables.');
  process.exit(1);
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);

export const prisma = new PrismaClient({ adapter });

// Stores { tenantId, tx? } for the lifetime of one request or explicit transaction.
export const tenantStorage = new AsyncLocalStorage();

const MODEL_NAMES = new Set(
  Object.values(Prisma.ModelName).map((name) => name.charAt(0).toLowerCase() + name.slice(1))
);

function wrapModel(modelName) {
  return new Proxy({}, {
    get(_target, method) {
      return (...args) => {
        const store = tenantStorage.getStore();

        if (store?.tx) {
          return store.tx[modelName][method](...args);
        }

        const tenantId = store?.tenantId;
        return prisma.$transaction(async (tx) => {
          if (tenantId) {
            await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`;
          }
          return tx[modelName][method](...args);
        });
      };
    },
  });
}

export const db = new Proxy(prisma, {
  get(target, prop) {
    if (prop === '$transaction') {
      return (input, options) => {
        const store = tenantStorage.getStore();
        const tenantId = store?.tenantId;

        if (typeof input === 'function') {
          return target.$transaction(async (tx) => {
            if (tenantId) {
              await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`;
            }
            return tenantStorage.run({ tenantId, tx }, () => input(tx));
          }, options);
        }

        return target.$transaction(input, options);
      };
    }

    if (typeof prop === 'string' && MODEL_NAMES.has(prop)) {
      return wrapModel(prop);
    }

    return target[prop];
  },
});

export async function connectDB() {
  try {
    await prisma.$connect();
    console.log('Connected to PostgreSQL via Prisma driver adapter successfully.');
  } catch (error) {
    console.error('Database connection failed:', error);
    process.exit(1);
  }
}

export async function disconnectDB() {
  await prisma.$disconnect();
  console.log('🔌 Database connection closed.');
}