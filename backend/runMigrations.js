import fs from 'fs';
import path from 'path';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Client } = pg;

async function runMigrations() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false } // Required for secure cloud connections like NeonDB
  });

  try {
    await client.connect();
    console.log('Connected to NeonDB successfully.');

    // 1. Wipe the remote public schema clean to prevent "already exists" errors
    console.log('🧹 Resetting remote database schema (dropping public schema)...');
    await client.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
    console.log('✨ Public schema reset successfully.');

    const migrationDir = path.resolve('migrateSQL');
    if (!fs.existsSync(migrationDir)) {
      console.error(`Directory not found: ${migrationDir}`);
      process.exit(1);
    }

    const files = fs.readdirSync(migrationDir)
      .filter(file => file.endsWith('.sql'))
      .sort();

    console.log(`Found ${files.length} migration files to execute.`);

    // 2. Run all migration files sequentially
    for (const file of files) {
      const filePath = path.join(migrationDir, file);
      const sql = fs.readFileSync(filePath, 'utf8');

      console.log(`⏳ Running migration: ${file}...`);
      await client.query(sql);
      console.log(`✨ Completed: ${file}`);
    }

    console.log(' All migrations executed successfully on NeonDB!');
  } catch (error) {
    console.error(' Migration failed:', error);
  } finally {
    await client.end();
  }
}

runMigrations();