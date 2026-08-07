import assert from 'node:assert/strict';
import { test, describe } from 'node:test';
import { createFinancialReconciliationService } from '../financialReconciliationService.js';

describe('FAN-020 & FAN-021: Financial Reconciliation and Coverage Service Tests', () => {
  test('FAN-020: checkFinancialReconciliation returns READY when balanced', async () => {
    const service = createFinancialReconciliationService();
    const runId = 'test-run-123';

    // Ledger = 10,000 TL, Open Lots = 12,000 TL, Unallocated Credit = 2,000 TL -> Expected = 10,000 TL (Balanced)
    const result = await service.checkFinancialReconciliation(runId, {
      ledgerBalance: 10000.00,
      openLotsTotal: 12000.00,
      unallocatedCredit: 2000.00,
      openInstrumentsTotal: 5000.00,
      virmanNetTotal: 0.00
    });

    assert.equal(result.readinessStatus, 'READY');
    assert.equal(result.unreconciledDifference, 0);
    assert.equal(result.ledgerBalance, 10000.00);
    assert.ok(result.reconciliationId);
  });

  test('FAN-020: checkFinancialReconciliation returns NOT_READY when unbalanced', async () => {
    const service = createFinancialReconciliationService();
    const runId = 'test-run-456';

    // Ledger = 10,000 TL, Open Lots = 12,000 TL, Unallocated Credit = 1,000 TL -> Expected = 11,000 TL (1,000 TL Unreconciled Diff)
    const result = await service.checkFinancialReconciliation(runId, {
      ledgerBalance: 10000.00,
      openLotsTotal: 12000.00,
      unallocatedCredit: 1000.00,
      openInstrumentsTotal: 5000.00,
      virmanNetTotal: 500.00
    });

    assert.equal(result.readinessStatus, 'NOT_READY');
    assert.equal(result.unreconciledDifference, 1500.00); // 1000 (ledger diff) + 500 (virman diff)
    assert.ok(result.warnings.length > 0);
  });

  test('FAN-021: calculateDataCoverage calculates 100% coverage correctly', async () => {
    const service = createFinancialReconciliationService();
    const summary = await service.calculateDataCoverage('FAN-001', {
      expectedRows: 50,
      processedRows: 50,
      expectedAmount: 50000.00,
      processedAmount: 50000.00
    });

    assert.equal(summary.metricCode, 'FAN-001');
    assert.equal(summary.coverageRatio, 100.0);
    assert.equal(summary.fallbackLevel, 'NONE');
    assert.ok(summary.coverageId);
  });

  test('FAN-021: calculateDataCoverage calculates partial coverage correctly', async () => {
    const service = createFinancialReconciliationService();
    const summary = await service.calculateDataCoverage('FAN-002', {
      expectedRows: 100,
      processedRows: 80,
      expectedAmount: 100000.00,
      processedAmount: 80000.00,
      nullReasons: { missing_customer_records: 20 },
      fallbackLevel: 'COMPANY_LEVEL'
    });

    assert.equal(summary.metricCode, 'FAN-002');
    assert.equal(summary.coverageRatio, 80.0);
    assert.equal(summary.fallbackLevel, 'COMPANY_LEVEL');
  });
});
