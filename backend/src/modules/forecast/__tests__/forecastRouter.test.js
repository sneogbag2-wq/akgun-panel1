import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import express from 'express';
import { createForecastRouter } from '../forecastRouter.js';

test('forecastRouter - Returns 404 when module feature flag is disabled', async () => {
  const app = express();
  app.use('/forecast', createForecastRouter({ enabled: false }));

  const response = await request(app).get('/forecast/status');
  assert.equal(response.status, 404);
  assert.equal(response.body.code, 'FEATURE_DISABLED');
});

test('forecastRouter - Returns forecast endpoints with mock repository', async () => {
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
                      data: [{ id: `${table}-1`, item_code: 'MAT-001', calculated_at: '2026-08-01' }],
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
  app.use('/forecast', createForecastRouter({ enabled: true }));

  const dailyRes = await request(app).get('/forecast/daily-model');
  assert.equal(dailyRes.status, 200);
  assert.equal(dailyRes.body.data.length, 1);

  const safetyRes = await request(app).get('/forecast/safety-stock');
  assert.equal(safetyRes.status, 200);
  assert.equal(safetyRes.body.data.length, 1);

  const riskRes = await request(app).get('/forecast/stockout-risk');
  assert.equal(riskRes.status, 200);
  assert.equal(riskRes.body.data.length, 1);

  const replRes = await request(app).get('/forecast/replenishment');
  assert.equal(replRes.status, 200);
  assert.equal(replRes.body.data.length, 1);
});

test('forecastRouter - Returns 500 when repository is missing', async () => {
  const app = express();
  app.use('/forecast', createForecastRouter({ enabled: true }));

  const response = await request(app).get('/forecast/daily-model');
  assert.equal(response.status, 500);
  assert.equal(response.body.error, 'Repository not initialized');
});
