import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import express from 'express';
import { createFinancialRouter } from '../financialRouter.js';

test('financialRouter - Calculates CEI, HealthScore, CreditLimit and analysis endpoints', async () => {
  const mockRepo = {
    getReceivableLots() {
      return Promise.resolve([{ amount: 10000, age_days: 30, status: 'OVERDUE', collected_amount: 8000 }]);
    },
    getHealthScoreComponents() {
      return Promise.resolve({ coverage: 80, cei_score: 90, dso_score: 80, payment_trend: 70 });
    },
    getLimitFactors() {
      return Promise.resolve({ operating_need: 100000, cash_capacity: 400000, behavior_factor: 1.0 });
    }
  };

  const app = express();
  app.use('/financial', createFinancialRouter({ repository: mockRepo }));

  const ceiRes = await request(app).get('/financial/cei?customerId=CUST-1');
  assert.equal(ceiRes.status, 200);
  assert.equal(ceiRes.body.cei, 80);

  const healthRes = await request(app).get('/financial/health-score?customerId=CUST-1');
  assert.equal(healthRes.status, 200);
  assert.equal(healthRes.body.healthScore, 95);


  const limitRes = await request(app).get('/financial/credit-limit?customerId=CUST-1');
  assert.equal(limitRes.status, 200);
  assert.equal(limitRes.body.effective_limit, 100000);

  const analysisRes = await request(app).get('/financial/analysis?customerId=CUST-1');
  assert.equal(analysisRes.status, 200);
  assert.equal(analysisRes.body.cei.cei, 80);
});
