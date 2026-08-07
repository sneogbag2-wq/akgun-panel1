import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import express from 'express';
import { createCurrentStockRouter } from '../currentStockRouter.js';
test('feature-disabled current-stock routes fail closed before creating a repository', async () => {
  const app = express(); app.use('/api/v2', createCurrentStockRouter({ requireSupabaseUser: (_req, _res, next) => next(), createRepositoryForAccessToken() { throw new Error('must not run'); }, enabled: false }));
  const response = await request(app).get('/api/v2/current-stock/status');
  assert.equal(response.status, 404); assert.equal(response.body.code, 'FEATURE_DISABLED');
});
