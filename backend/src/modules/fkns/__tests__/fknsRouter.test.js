import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import express from 'express';
import { createFknsRouter } from '../fknsRouter.js';

test('fknsRouter - Triggers FKNS analysis and records metrics', async () => {
  const recordedMetrics = [];
  const mockMetricEngine = {
    async recordMetric(runId, entityId, metricCode, value) {
      recordedMetrics.push({ runId, entityId, metricCode, value });
    }
  };

  const app = express();
  app.use(express.json());
  app.use('/fkns', createFknsRouter({ metricEngineService: mockMetricEngine }));

  const response = await request(app)
    .post('/fkns/analyze')
    .send({
      regionId: 'REG-TR-01',
      runId: 'RUN-2026-001',
      rawFknsData: {
        activeDays: 20,
        expectedDays: 25,
        uniqueBuyers: 80,
        totalTargetCustomers: 100,
        totalInvoices: 240
      }
    });

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.equal(recordedMetrics.length, 3);
  assert.equal(recordedMetrics[0].metricCode, 'FKNS-001');
  assert.equal(recordedMetrics[1].metricCode, 'FKNS-002');
  assert.equal(recordedMetrics[2].metricCode, 'FKNS-003');
});

test('fknsRouter - Returns 400 when required fields are missing', async () => {
  const app = express();
  app.use(express.json());
  app.use('/fkns', createFknsRouter({ metricEngineService: {} }));

  const response = await request(app)
    .post('/fkns/analyze')
    .send({ regionId: 'REG-01' }); // missing runId and rawFknsData

  assert.equal(response.status, 400);
  assert.equal(response.body.error, 'Missing required fields');
});

test('fknsRouter - Returns 500 when metricEngineService throws error', async () => {
  const mockMetricEngine = {
    async recordMetric() {
      throw new Error('Engine storage failed');
    }
  };

  const app = express();
  app.use(express.json());
  app.use('/fkns', createFknsRouter({ metricEngineService: mockMetricEngine }));

  const response = await request(app)
    .post('/fkns/analyze')
    .send({
      regionId: 'REG-TR-01',
      runId: 'RUN-2026-001',
      rawFknsData: { activeDays: 20, expectedDays: 25, totalTargetCustomers: 100, uniqueBuyers: 80 }
    });

  assert.equal(response.status, 500);
  assert.equal(response.body.error, 'Engine storage failed');
});

