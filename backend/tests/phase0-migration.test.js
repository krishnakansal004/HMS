import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from '@jest/globals';
import { applyMigrations, getMigrationFiles, parseMigrationArgs } from '../runMigrations.js';

describe('Phase 0 migration workflow', () => {
  it('supports explicit reset and baseline flags without making them implicit', () => {
    expect(parseMigrationArgs(['--reset-dev'])).toMatchObject({ resetDevelopment: true });
    expect(parseMigrationArgs(['--baseline-existing'])).toMatchObject({ baselineExisting: true });
    expect(parseMigrationArgs([])).toMatchObject({ resetDevelopment: false, baselineExisting: false });
  });

  it('records applied migration checksums and rejects modified applied SQL', async () => {
    const migration = getMigrationFiles(path.dirname(new URL('../migrateSQL/0000_enable_pgcrypto.sql', import.meta.url).pathname))[0];
    const queries = [];
    const client = {
      async query(sql, values) {
        queries.push({ sql, values });
        if (sql.includes('SELECT migration_name, checksum FROM schema_migrations')) return { rows: [] };
        return { rows: [] };
      },
    };

    await applyMigrations(client, [migration]);
    expect(queries.some(({ sql }) => sql.includes('INSERT INTO schema_migrations'))).toBe(true);

    const changedClient = {
      async query(sql) {
        if (sql.includes('SELECT migration_name, checksum FROM schema_migrations')) {
          return { rows: [{ migration_name: migration.name, checksum: 'changed-checksum' }] };
        }
        return { rows: [] };
      },
    };
    await expect(applyMigrations(changedClient, [migration])).rejects.toThrow(/checksum changed/i);
  });

  it('ships the subscription migration with recurring-period fields', () => {
    const sql = fs.readFileSync(path.resolve(process.cwd(), 'migrateSQL/0068_create_tenant_subscription_table.sql'), 'utf8');
    expect(sql).toMatch(/CREATE TABLE tenant_subscription/i);
    expect(sql).toMatch(/razorpay_subscription_id/i);
    expect(sql).toMatch(/current_period_end/i);
    expect(sql).toMatch(/FORCE ROW LEVEL SECURITY/i);
  });
});
