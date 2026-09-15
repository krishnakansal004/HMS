import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Client } = pg;
export const MIGRATION_TABLE = 'schema_migrations';
const MIGRATION_LOCK_KEY = 764321109;

export function migrationDirectory() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'migrateSQL');
}

export function getMigrationFiles(directory = migrationDirectory()) {
  if (!fs.existsSync(directory)) {
    throw new Error(`Migration directory does not exist: ${directory}`);
  }
  return fs.readdirSync(directory)
    .filter((file) => file.endsWith('.sql'))
    .sort()
    .map((file) => ({
      name: file,
      path: path.join(directory, file),
      checksum: checksum(fs.readFileSync(path.join(directory, file), 'utf8')),
    }));
}

export function checksum(sql) {
  return crypto.createHash('sha256').update(sql).digest('hex');
}

export function parseMigrationArgs(argv = process.argv.slice(2)) {
  return {
    resetDevelopment: argv.includes('--reset-dev'),
    baselineExisting: argv.includes('--baseline-existing'),
    help: argv.includes('--help') || argv.includes('-h'),
  };
}

export async function ensureMigrationTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS ${MIGRATION_TABLE} (
      migration_name VARCHAR(255) PRIMARY KEY,
      checksum VARCHAR(64) NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function resetDevelopmentDatabase(client) {
  if (process.env.NODE_ENV !== 'development') {
    throw new Error('--reset-dev is allowed only when NODE_ENV=development.');
  }

  console.warn('Development reset requested: dropping the public schema.');
  await client.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await ensureMigrationTable(client);
}

async function baselineExistingDatabase(client, files) {
  if (process.env.ALLOW_MIGRATION_BASELINE !== 'true') {
    throw new Error(
      '--baseline-existing requires ALLOW_MIGRATION_BASELINE=true. Verify the database manually before baselining.',
    );
  }
  const baselineVersion = process.env.MIGRATION_BASELINE_VERSION;
  if (!baselineVersion) {
    throw new Error(
      'MIGRATION_BASELINE_VERSION is required. Set it to the last migration already present in the database.',
    );
  }
  const baselineIndex = files.findIndex((file) => file.name === baselineVersion);
  if (baselineIndex < 0) {
    throw new Error(`Unknown MIGRATION_BASELINE_VERSION: ${baselineVersion}`);
  }
  const baselineFiles = files.slice(0, baselineIndex + 1);

  const { rows } = await client.query(`SELECT COUNT(*)::int AS count FROM ${MIGRATION_TABLE}`);
  if (rows[0].count !== 0) {
    throw new Error('Cannot baseline: schema_migrations is not empty.');
  }

  await client.query('BEGIN');
  try {
    for (const file of baselineFiles) {
      await client.query(
        `INSERT INTO ${MIGRATION_TABLE} (migration_name, checksum) VALUES ($1, $2)`,
        [file.name, file.checksum],
      );
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
  console.log(`Baselined migrations through ${baselineVersion}.`);
}

export async function applyMigrations(client, files = getMigrationFiles()) {
  const { rows } = await client.query(
    `SELECT migration_name, checksum FROM ${MIGRATION_TABLE} ORDER BY migration_name`,
  );
  const applied = new Map(rows.map((row) => [row.migration_name, row.checksum]));

  for (const file of files) {
    const previousChecksum = applied.get(file.name);
    if (previousChecksum) {
      if (previousChecksum !== file.checksum) {
        throw new Error(`Migration checksum changed after application: ${file.name}`);
      }
      continue;
    }

    const sql = fs.readFileSync(file.path, 'utf8');
    console.log(`Applying migration: ${file.name}`);
    await client.query('BEGIN');
    try {
      await client.query(sql);
      await client.query(
        `INSERT INTO ${MIGRATION_TABLE} (migration_name, checksum) VALUES ($1, $2)`,
        [file.name, file.checksum],
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw new Error(`Migration failed (${file.name}): ${error.message}`, { cause: error });
    }
  }
}

export async function runMigrations({ client, args = parseMigrationArgs() } = {}) {
  if (args.help) {
    console.log('Usage: node runMigrations.js [--reset-dev] [--baseline-existing]');
    return;
  }

  const ownsClient = !client;
  const migrationClient = client || new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : undefined,
  });

  try {
    if (ownsClient) await migrationClient.connect();
    await migrationClient.query(`SELECT pg_advisory_lock(${MIGRATION_LOCK_KEY})`);

    if (args.resetDevelopment) {
      await resetDevelopmentDatabase(migrationClient);
    } else {
      await ensureMigrationTable(migrationClient);
    }

    const files = getMigrationFiles();
    const { rows } = await migrationClient.query(
      `SELECT COUNT(*)::int AS count FROM ${MIGRATION_TABLE}`,
    );
    if (args.baselineExisting && rows[0].count === 0) {
      await baselineExistingDatabase(migrationClient, files);
    }
    await applyMigrations(migrationClient, files);
    console.log('All pending migrations applied successfully.');
  } finally {
    try {
      await migrationClient.query(`SELECT pg_advisory_unlock(${MIGRATION_LOCK_KEY})`);
    } finally {
      if (ownsClient) await migrationClient.end();
    }
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  runMigrations().catch((error) => {
    console.error('Migration failed:', error.message);
    process.exitCode = 1;
  });
}
