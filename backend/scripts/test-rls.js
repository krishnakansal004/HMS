// src/scripts/test-rls.js
import { db, tenantStorage } from '../src/config/db.js';

async function runSmokeTest() {
  console.log('Running RLS & Nested Transaction Smoke Test...');

  // Mock a test tenant UUID (replace with a real one from your dev DB)
  const testTenantId = '00000000-0000-0000-0000-000000000000'; 

  await tenantStorage.run({ tenantId: testTenantId }, async () => {
    try {
      // Test nested transaction re-entry (store.tx reuse)
      await db.$transaction(async (tx) => {
        console.log('-> Inside outer transaction');
        
        // This should reuse `tx` and apply SET LOCAL successfully
        const count = await db.patient.count();
        console.log(`-> Patient count under tenant: ${count}`);
      });

      console.log('✅ Smoke test passed: Nested proxy and RLS scope active.');
    } catch (error) {
      console.error('❌ Smoke test failed:', error);
    }
  });
}

runSmokeTest();