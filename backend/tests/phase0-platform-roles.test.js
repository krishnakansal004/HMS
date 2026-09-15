import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from '@jest/globals';

const read = (file) => fs.readFileSync(path.resolve(process.cwd(), 'src/routes', file), 'utf8');

describe('Phase 0 platform role boundaries', () => {
  it('does not expose cross-tenant platform routes to DIRECTOR', () => {
    for (const file of ['plans.js', 'tenants.js', 'planRequests.js', 'planReceipts.js']) {
      expect(read(file)).not.toMatch(/requireRoles\([^\n]*SYSTEM_OWNER[^\n]*DIRECTOR/);
    }
  });

  it('keeps the platform analytics endpoint system-owner-only', () => {
    expect(read('analytics.js')).toMatch(/\/platform[\s\S]*requireRoles\("SYSTEM_OWNER"\)/);
  });
});
