import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import express from 'express';
import { createLedgerRouter } from '../ledgerRouter.js';

test('ledgerRouter - Returns 404 when module feature flag is disabled', async () => {
  const app = express();
  app.use('/ledger', createLedgerRouter({ enabled: false }));

  const response = await request(app).get('/ledger/status');
  assert.equal(response.status, 404);
  assert.equal(response.body.code, 'FEATURE_DISABLED');
});

test('ledgerRouter - Returns ledger entries and status when module is enabled', async () => {
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
                      data: [{ id: `${table}-1`, calculated_at: '2026-08-01' }],
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
  app.use('/ledger', createLedgerRouter({ enabled: true }));

  const statusRes = await request(app).get('/ledger/status');
  assert.equal(statusRes.status, 200);
  assert.equal(statusRes.body.status, 'active');

  const listRes = await request(app).get('/ledger');
  assert.equal(listRes.status, 200);

  const agingRes = await request(app).get('/ledger/aging-migration');
  assert.equal(agingRes.status, 200);
  assert.equal(agingRes.body.data.length, 1);

  const stressRes = await request(app).get('/ledger/stress-scenarios');
  assert.equal(stressRes.status, 200);
  assert.equal(stressRes.body.data.length, 1);
});

test('ledgerRouter - Returns 500 when repository is missing for aging endpoints', async () => {
  const app = express();
  app.use('/ledger', createLedgerRouter({ enabled: true }));

  const response = await request(app).get('/ledger/aging-migration');
  assert.equal(response.status, 500);
  assert.equal(response.body.error, 'Repository not initialized');
});
