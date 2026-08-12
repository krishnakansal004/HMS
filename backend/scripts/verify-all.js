// scripts/verify-all.js
import { db, tenantStorage, prisma } from '../src/config/db.js';
import { InvoiceRepository } from '../src/repositories/invoiceRepository.js';
import { InventoryRepository } from '../src/repositories/inventoryRepository.js';

async function runRigorousVerification() {
  console.log('🔍 Starting Rigorous End-to-End Verification (Audited + Nested Proxy Test)...\n');

  try {
    // -------------------------------------------------------------------------
    // TEST 1: RLS Fail-Closed Check (No Tenant Context)
    // -------------------------------------------------------------------------
    console.log('Test 1: RLS Fail-Closed (Querying without tenant context)...');
    const untenantedPatients = await db.patient.findMany();
    if (untenantedPatients.length === 0) {
      console.log('✅ PASSED: RLS successfully blocked access (0 rows returned).\n');
    } else {
      throw new Error('SECURITY VIOLATION: RLS leaked rows without tenant context!');
    }

    const testTenantId = '11111111-1111-1111-1111-111111111111';

    await prisma.tenant.upsert({
      where: { tenant_id: testTenantId },
      update: {},
      create: { tenant_id: testTenantId, name: 'Audit Test Hospital' }
    });

    await tenantStorage.run({ tenantId: testTenantId }, async () => {
      const patient = await db.patient.create({
        data: {
          tenant_id: testTenantId,
          first_name: 'Jane',
          last_name: 'Doe',
          gender: 'Female',
          phone: '8888888888'
        }
      });

      // -------------------------------------------------------------------------
      // TEST 2: Tenant Scoping & Isolation Check
      // -------------------------------------------------------------------------
      console.log('Test 2: Tenant-Scoped Query Execution...');
      const patientCount = await db.patient.count();
      if (patientCount > 0) {
        console.log(`✅ PASSED: Tenant isolation active. Patient count: ${patientCount}\n`);
      } else {
        throw new Error('Tenant isolation check failed.');
      }

      // -------------------------------------------------------------------------
      // TEST 3: REAL Advisory Lock & Concurrent Sequential Numbering Test
      // -------------------------------------------------------------------------
      console.log('Test 3: InvoiceRepository.createInvoiceTransaction (Advisory Lock Concurrency)...');

      const [inv1, inv2] = await Promise.all([
        InvoiceRepository.createInvoiceTransaction({
          tenantId: testTenantId,
          patientId: patient.patient_id,
          subtotal: 100,
          gstTotal: 10,
          total: 110,
          status: 'pending',
          items: [{ itemName: 'Consultation', quantity: 1, unitPrice: 100, gstRate: 10 }]
        }),
        InvoiceRepository.createInvoiceTransaction({
          tenantId: testTenantId,
          patientId: patient.patient_id,
          subtotal: 200,
          gstTotal: 20,
          total: 220,
          status: 'pending',
          items: [{ itemName: 'Procedure', quantity: 1, unitPrice: 200, gstRate: 10 }]
        })
      ]);

      console.log(`-> Concurrently generated invoice numbers: #${inv1.invoice_number} and #${inv2.invoice_number}`);

      if (inv1.invoice_number !== inv2.invoice_number && inv1.invoice_number > 0 && inv2.invoice_number > 0) {
        console.log('✅ PASSED: Advisory lock successfully coordinated sequential invoice numbering.\n');
      } else {
        throw new Error('Advisory lock concurrency test failed: Duplicate invoice numbers generated.');
      }

      // -------------------------------------------------------------------------
      // TEST 4: REAL Stock Atomicity & Insufficient Stock Guard Test
      // -------------------------------------------------------------------------
      console.log('Test 4: InventoryRepository.adjustStockTransaction (Stock Guard & Error Handling)...');

      const medicine = await InventoryRepository.createMedicine({
        tenant_id: testTenantId,
        name: 'Paracetamol Test',
        batch_number: 'BATCH-AUDIT-01',
        expiry_date: new Date(Date.now() + 8640000000),
        purchase_price: 10,
        selling_price: 15,
        quantity: 10,
        reorder_level: 5
      });

      const dispenseResult = await InventoryRepository.adjustStockTransaction({
        tenantId: testTenantId,
        medicineId: medicine.medicine_id,
        type: 'DISPENSE',
        quantity: -5,
        notes: 'Valid dispense audit'
      });

      if (dispenseResult.medicine.quantity === 5) {
        console.log('-> Valid stock deduction succeeded. Remaining stock: 5.');
      } else {
        throw new Error(`Expected remaining stock to be 5, but got ${dispenseResult.medicine.quantity}`);
      }

      let caughtInsufficientStockError = false;
      try {
        await InventoryRepository.adjustStockTransaction({
          tenantId: testTenantId,
          medicineId: medicine.medicine_id,
          type: 'DISPENSE',
          quantity: -20,
          notes: 'Over-dispense audit'
        });
      } catch (err) {
        if (err.message === 'INSUFFICIENT_STOCK') {
          caughtInsufficientStockError = true;
        } else {
          throw new Error(`Unexpected error caught: ${err.message}`);
        }
      }

      if (caughtInsufficientStockError) {
        console.log('✅ PASSED: Stock guard correctly intercepted over-dispense.\n');
      } else {
        throw new Error('SECURITY FAILURE: Over-dispense succeeded without error!');
      }

      // -------------------------------------------------------------------------
      // TEST 5: Nested Transaction Reuse Proof (`store?.tx` Proxy Interception)
      //
      // A plain `typeof result === 'number'` check here can't fail either way:
      // even if reuse is completely broken and `db.X` opens an independent
      // transaction instead of `tx`, that independent transaction still has
      // `tenantId` from the same ALS store, still passes RLS, and still
      // returns a valid number. That doesn't distinguish reuse from no-reuse.
      //
      // What DOES distinguish them: visibility of an UNCOMMITTED write.
      // A row created via `tx.X.create()` is visible to `db.X.findUnique()`
      // in the same callback only if `db.X` is really running inside `tx`.
      // If `db.X` opened a second, independent transaction instead, that
      // transaction runs under Read Committed isolation and can't see the
      // first transaction's uncommitted row — `findUnique` comes back null.
      // The whole probe is rolled back on purpose so it never touches real data.
      // -------------------------------------------------------------------------
      console.log('Test 5: Nested Transaction Proxy Reuse (`store?.tx` check)...');

      let uncommittedRowWasVisible = false;
      const probeId = '22222222-2222-2222-2222-222222222222';

      try {
        await db.$transaction(async (tx) => {
          // Uncommitted write, visible only within this same transaction.
          await tx.patient.create({
            data: {
              patient_id: probeId,
              tenant_id: testTenantId,
              first_name: 'Nested',
              last_name: 'Probe',
              gender: 'Other',
              phone: '7777777777'
            }
          });

          // Deliberately use `db.patient` instead of `tx.patient` here.
          // Only reuse (store.tx) can see the row created above.
          const seenViaDb = await db.patient.findUnique({ where: { patient_id: probeId } });
          uncommittedRowWasVisible = seenViaDb !== null;

          // Always roll back — this is a probe, not real data.
          throw new Error('INTENTIONAL_ROLLBACK');
        });
      } catch (err) {
        if (err.message !== 'INTENTIONAL_ROLLBACK') {
          throw err;
        }
      }

      // Confirm the rollback actually happened — the probe row must NOT exist now.
      const probeAfterRollback = await db.patient.findUnique({ where: { patient_id: probeId } });

      if (uncommittedRowWasVisible && probeAfterRollback === null) {
        console.log('✅ PASSED: db.patient saw the uncommitted row from tx (real reuse), and the rollback discarded it cleanly.\n');
      } else if (!uncommittedRowWasVisible) {
        throw new Error(
          'NESTED REUSE BROKEN: db.X inside an explicit transaction did not see the uncommitted write — ' +
          'it opened an independent transaction instead of reusing tx. Atomicity guarantee is not real.'
        );
      } else {
        throw new Error('Rollback did not clean up the probe row — investigate before trusting this result.');
      }
    });

    await prisma.tenant.delete({ where: { tenant_id: testTenantId } }).catch(() => {});

    console.log('🎉 100% RIGOROUS END-TO-END AUDIT & PROXIES PASSED!');
  } catch (error) {
    console.error('❌ Rigorous verification failed:', error);
    process.exit(1);
  }
}

runRigorousVerification();