import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import express from 'express';
import { createEngineRouter } from '../engineRouter.js';

test('engineRouter - Returns 404 when module feature flag is disabled', async () => {
  const app = express();
  app.use('/engine', createEngineRouter({ enabled: false }));

  const response = await request(app).get('/engine/status');
  assert.equal(response.status, 404);
  assert.equal(response.body.code, 'FEATURE_DISABLED');
});

test('engineRouter - Returns engine status and metric registry list', async () => {
  const mockRepo = {
    supabase: {
      from(table) {
        return {
          select() {
            return {
              order() {
                return {
                  limit() {
                    return Promise.resolve({
                      data: [{ metric_id: 'MET-001', metric_name: 'DSO' }],
                      error: null
                    });
                  }
                };
              }
            };
          }
        };
      }
    }
  };

  const app = express();
  app.use((req, _res, next) => {
    req.repository = mockRepo;
    next();
  });
  app.use('/engine', createEngineRouter({ enabled: true }));

  const statusRes = await request(app).get('/engine/status');
  assert.equal(statusRes.status, 200);
  assert.equal(statusRes.body.status, 'active');

  const metricRes = await request(app).get('/engine/advanced/metric-registry');
  assert.equal(metricRes.status, 200);
  assert.equal(metricRes.body.data.length, 1);

  const opsRes = await request(app).get('/engine/ops-documents');
  assert.equal(opsRes.status, 200);

  const stlRes = await request(app).get('/engine/stl-matched-signals');
  assert.equal(stlRes.status, 200);
});

test('engineRouter - Returns 500 when repository is missing', async () => {
  const app = express();
  app.use('/engine', createEngineRouter({ enabled: true }));

  const response = await request(app).get('/engine/ops-documents');
  assert.equal(response.status, 500);
  assert.equal(response.body.error, 'Repository not initialized');
});
