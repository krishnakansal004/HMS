import fs from 'fs';
import path from 'path';
import 'dotenv/config';
import postgres from 'postgres';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('❌ DATABASE_URL is not defined in environment variables.');
  process.exit(1);
}

const sql = postgres(connectionString);
const migrationsDir = path.resolve('migrateSQL');

async function runMigrations() {
  try {
    console.log('🔄 Connecting to database and checking migration history...');

    // 1. Ensure the migration tracking table exists
    await sql`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    // 2. Read all files from the migrateSQL folder
    if (!fs.existsSync(migrationsDir)) {
      console.error(`❌ Directory not found: ${migrationsDir}`);
      process.exit(1);
    }

    const files = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort(); // Sorts alphabetically (e.g., 001_..., 002_...)

    if (files.length === 0) {
      console.log('⚠️ No SQL files found in migrateSQL directory.');
      process.exit(0);
    }

    // 3. Fetch already executed migrations
    const executedRows = await sql`SELECT filename FROM schema_migrations;`;
    const executedSet = new Set(executedRows.map(row => row.filename));

    // 4. Run pending migrations sequentially
    for (const file of files) {
      if (executedSet.has(file)) {
        console.log(`⏩ Skipping already executed: ${file}`);
        continue;
      }

      console.log(`🚀 Executing migration: ${file}...`);
      const filePath = path.join(migrationsDir, file);
      const queryText = fs.readFileSync(filePath, 'utf-8');

      // Execute SQL file inside a transaction block for safety
      await sql.begin(async (tx) => {
        await tx.unsafe(queryText);
        await tx`INSERT INTO schema_migrations (filename) VALUES (${file});`;
      });

      console.log(`✅ Successfully applied: ${file}`);
    }

    console.log('🎉 All migrations executed successfully!');
    await sql.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    await sql.end();
    process.exit(1);
  }
}

runMigrations();