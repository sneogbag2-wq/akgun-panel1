import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';
import { createCustomerMasterRouter } from '../customerMasterRouter.js';

function auth(_req, _res, next) {
  _req.correlationId = 'anonymous-correlation';
  _req.authUser = { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', accessToken: 'anonymous-token' };
  next();
}

function app(enabled) {
  const server = express();
  server.use(express.json());
  server.use('/api/v2', createCustomerMasterRouter({
    requireSupabaseUser: auth,
    enabled,
    createRepositoryForAccessToken() {
      return {
        list: async () => ({ items: [], coverage: { status: 'AVAILABLE' } }),
        customer: async () => ({ customerCode: '5000000001' }),
        history: async () => ({ statusHistory: [] }),
        organization: async () => ({ items: [] }),
        reconciliation: async () => ({ customerCount: 0 }),
      };
    },
  }));
  server.post('/api/v2/imports/initiate', (_req, res) => res.status(204).end());
  return server;
}

test('customer_master_v2 remains fail-closed while the server-side flag is disabled', async () => {
  const response = await request(app(false)).get('/api/v2/customers').set('Authorization', 'Bearer anonymous-token');
  assert.equal(response.status, 404);
  assert.equal(response.body.code, 'FEATURE_DISABLED');
});

test('enabled customer-master route uses bearer-auth service and exposes only the parallel v2 response', async () => {
  const response = await request(app(true)).get('/api/v2/customers').set('Authorization', 'Bearer anonymous-token');
  assert.equal(response.status, 200);
  assert.deepEqual(response.body.items, []);
});

test('disabled customer-master flag does not intercept Package 01 import URLs', async () => {
  const response = await request(app(false)).post('/api/v2/imports/initiate');
  assert.equal(response.status, 204);
});
