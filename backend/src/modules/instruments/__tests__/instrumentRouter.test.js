import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import express from 'express';
import { createInstrumentRouter } from '../instrumentRouter.js';

test('instrumentRouter - Returns 404 when module is not enabled', async () => {
  const app = express();
  app.use('/instruments', createInstrumentRouter({ enabled: false }));

  const response = await request(app).post('/instruments/accept-note');
  assert.equal(response.status, 404);
  assert.equal(response.body.error, 'Instruments V2 module is not enabled.');
});

test('instrumentRouter - Accepts note successfully', async () => {
  const mockRepo = {
    acceptNote(params) {
      return Promise.resolve({ success: true, instrumentId: 'INST-001', exposureUpdated: true });
    }
  };

  const app = express();
  app.use(express.json());
  app.use('/instruments', createInstrumentRouter({
    enabled: true,
    requireSupabaseUser: (req, res, next) => next(),
    createRepositoryForAccessToken: () => mockRepo
  }));

  const response = await request(app)
    .post('/instruments/accept-note')
    .set('Authorization', 'Bearer test-token')
    .send({ customerId: 'CUST-1', amount: 50000, idempotencyKey: 'IDEM-999' });

  assert.equal(response.status, 201);
  assert.equal(response.body.success, true);
  assert.equal(response.body.instrumentId, 'INST-001');
});

test('instrumentRouter - Returns 400 when required parameters are missing', async () => {
  const app = express();
  app.use(express.json());
  app.use('/instruments', createInstrumentRouter({
    enabled: true,
    requireSupabaseUser: (req, res, next) => next(),
    createRepositoryForAccessToken: () => ({})
  }));

  const response = await request(app)
    .post('/instruments/accept-note')
    .send({ customerId: 'CUST-1' });

  assert.equal(response.status, 400);
});
