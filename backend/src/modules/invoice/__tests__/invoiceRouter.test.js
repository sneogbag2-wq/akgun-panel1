import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import express from 'express';
import { createInvoiceRouter } from '../invoiceRouter.js';

test('invoiceRouter - Returns 404 when module feature flag is disabled', async () => {
  const app = express();
  app.use('/invoice', createInvoiceRouter({ enabled: false }));

  const response = await request(app).get('/invoice');
  assert.equal(response.status, 404);
  assert.equal(response.body.code, 'FEATURE_DISABLED');
});

test('invoiceRouter - Returns invoice list when module is enabled', async () => {
  const app = express();
  app.use('/invoice', createInvoiceRouter({ enabled: true }));

  const response = await request(app).get('/invoice');
  assert.equal(response.status, 200);
  assert.equal(Array.isArray(response.body.data), true);
});
