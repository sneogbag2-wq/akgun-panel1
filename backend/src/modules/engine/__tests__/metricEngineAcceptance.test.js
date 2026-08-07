import test from 'node:test';
import assert from 'node:assert/strict';
import { createMetricEngineService } from '../metricEngineService.js';

test('Paket 13: Merkezi Metrik Motoru Testleri', async (t) => {
  const createMockRepository = () => ({});

  await t.test('1. Metrik Motoru Fonksiyonları Aktif Edilmiştir', async () => {
    const repo = createMockRepository();
    const service = createMetricEngineService(repo);

    assert.equal(service._isBlocked, false);

    const run = await service.startRun('2026-08-01');
    assert.ok(run.runId);
    assert.equal(run.status, 'PENDING');

    const record = await service.recordMetric('run1', 'CUST-1', 'FIN-013', 15);
    assert.ok(record.id);
    assert.equal(record.metricCode, 'FIN-013');
    assert.equal(record.resultClass, 'FACT');

    const complete = await service.completeRun('run1');
    assert.equal(complete.status, 'SUCCESS');

    const latest = await service.getLatestMetric('CUST-1', 'FIN-013');
    assert.equal(latest.metricCode, 'FIN-013');
    assert.equal(latest.resultClass, 'FACT');
  });
});
