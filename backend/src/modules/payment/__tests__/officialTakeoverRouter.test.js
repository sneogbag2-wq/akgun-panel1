import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import express from 'express';
import { createOfficialTakeoverRouter } from '../officialTakeoverRouter.js';

test('officialTakeoverRouter - High match rate (>= 80%) deactivates transient docs and returns RECONCILED_WITH_EXCEPTIONS', async () => {
  const insertedRecords = [];
  const deactivatedIds = [];

  const mockClient = {
    from(table) {
      if (table === 'ops_doc_transient') {
        return {
          select() {
            return {
              eq(col, val) {
                return Promise.resolve({
                  data: [
                    { id: 'trans-1', document_no: 'OFF-001', customer_id: 'CUST-100', amount: 500, is_active: true },
                    { id: 'trans-2', document_no: 'OFF-002', customer_id: 'CUST-200', amount: 1000, is_active: true }
                  ],
                  error: null
                });
              }
            };
          },
          update(updates) {
            return {
              in(col, ids) {
                deactivatedIds.push(...ids);
                return Promise.resolve({ error: null });
              }
            };
          }
        };
      }
      if (table === 'official_collection_takeover') {
        return {
          insert(records) {
            insertedRecords.push(...records);
            return Promise.resolve({ error: null });
          }
        };
      }
      return {};
    }
  };

  const app = express();
  app.use(express.json());
  app.use('/payment/official-takeover', createOfficialTakeoverRouter({ clients: { serviceClient: mockClient } }));

  const response = await request(app)
    .post('/payment/official-takeover/reconcile-takeover')
    .send({
      officialCollections: [
        { id: 'off-1', documentNo: 'OFF-001', customerId: 'CUST-100', amount: 500 }
      ]
    });

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.matchedCount, 1);
  assert.equal(response.body.batchMatchRate, 100);
  assert.equal(response.body.status, 'RECONCILED_WITH_EXCEPTIONS');
  assert.equal(insertedRecords.length, 1);
  assert.equal(deactivatedIds.includes('trans-1'), true);
});

test('officialTakeoverRouter - Low match rate (< 80%) returns LOW_MATCH_REVIEW status', async () => {
  const mockClient = {
    from(table) {
      if (table === 'ops_doc_transient') {
        return {
          select() {
            return {
              eq() {
                return Promise.resolve({
                  data: [],
                  error: null
                });
              }
            };
          }
        };
      }
      return {};
    }
  };

  const app = express();
  app.use(express.json());
  app.use('/payment/official-takeover', createOfficialTakeoverRouter({ clients: { serviceClient: mockClient } }));

  const response = await request(app)
    .post('/payment/official-takeover/reconcile-takeover')
    .send({
      officialCollections: [
        { id: 'off-1', documentNo: 'OFF-999', customerId: 'CUST-999', amount: 999 }
      ]
    });

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.matchedCount, 0);
  assert.equal(response.body.batchMatchRate, 0);
  assert.equal(response.body.status, 'LOW_MATCH_REVIEW');
});

test('officialTakeoverRouter - Returns 500 when DB client is unavailable', async () => {
  const app = express();
  app.use(express.json());
  app.use('/payment/official-takeover', createOfficialTakeoverRouter({ clients: {} }));

  const response = await request(app)
    .post('/payment/official-takeover/reconcile-takeover')
    .send({ officialCollections: [] });

  assert.equal(response.status, 500);
  assert.equal(response.body.error, 'Database client unavailable');
});
