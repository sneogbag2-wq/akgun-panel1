import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import express from 'express';
import { createOverrideRouter } from '../overrideRouter.js';

test('overrideRouter - Soft delete entry successfully', async () => {
  const mockRepo = {
    runInTransaction(fn) {
      return fn({
        async getEntryById(id) {
          return { id, amount: 100, deleted_at: null };
        },
        async updateEntry(id, fields) {
          return true;
        }
      });
    }
  };

  const app = express();
  app.use(express.json());
  app.use('/ledger/override', createOverrideRouter({ repository: mockRepo }));

  const response = await request(app)
    .post('/ledger/override/soft-delete')
    .send({ entryId: 'entry-100' });

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
});

test('overrideRouter - Override entry successfully', async () => {
  const mockRepo = {
    runInTransaction(fn) {
      return fn({
        async getEntryById(id) {
          return { id, customer_id: 'CUST-1', amount: 100, deleted_at: null };
        },
        async updateEntry(id, fields) {
          return true;
        },
        async insertEntry(fields) {
          return 'entry-new-1';
        }
      });
    }
  };

  const app = express();
  app.use(express.json());
  app.use('/ledger/override', createOverrideRouter({ repository: mockRepo }));

  const response = await request(app)
    .post('/ledger/override/override')
    .send({ oldEntryId: 'entry-100', newAmount: 250 });

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.newEntryId, 'entry-new-1');
});

test('overrideRouter - Returns 400 when parameters are missing', async () => {
  const app = express();
  app.use(express.json());
  app.use('/ledger/override', createOverrideRouter({ repository: {} }));

  const res1 = await request(app).post('/ledger/override/soft-delete').send({});
  assert.equal(res1.status, 400);

  const res2 = await request(app).post('/ledger/override/override').send({});
  assert.equal(res2.status, 400);
});
