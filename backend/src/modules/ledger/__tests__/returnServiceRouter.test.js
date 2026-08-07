import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import express from 'express';
import { createReturnServiceRouter } from '../returnServiceRouter.js';

test('returnServiceRouter - Registers IADE and HIZMET credit event successfully', async () => {
  let insertedEvent = null;

  const mockClient = {
    from(table) {
      if (table === 'return_service_credit_event') {
        return {
          insert(event) {
            insertedEvent = { id: 'evt-999', ...event };
            return {
              select() {
                return {
                  single() {
                    return Promise.resolve({ data: insertedEvent, error: null });
                  }
                };
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
  app.use('/ledger/return-service-credit', createReturnServiceRouter({ clients: { serviceClient: mockClient } }));

  const response = await request(app)
    .post('/ledger/return-service-credit/register')
    .send({
      customerId: 'CUST-300',
      documentNo: 'IADE-2026-001',
      creditType: 'IADE',
      amount: 1500
    });

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.record.customer_id, 'CUST-300');
  assert.equal(response.body.record.document_no, 'IADE-2026-001');
  assert.equal(response.body.record.credit_type, 'IADE');
  assert.equal(response.body.record.amount, 1500);
});

test('returnServiceRouter - Returns 400 when required parameters are missing', async () => {
  const app = express();
  app.use(express.json());
  app.use('/ledger/return-service-credit', createReturnServiceRouter({ clients: { serviceClient: {} } }));

  const response = await request(app)
    .post('/ledger/return-service-credit/register')
    .send({ customerId: 'CUST-300', documentNo: 'IADE-001' }); // missing amount

  assert.equal(response.status, 400);
  assert.equal(response.body.error, 'customerId, documentNo, and amount are required');
});

test('returnServiceRouter - Returns 500 when DB client is unavailable', async () => {
  const app = express();
  app.use(express.json());
  app.use('/ledger/return-service-credit', createReturnServiceRouter({ clients: {} }));

  const response = await request(app)
    .post('/ledger/return-service-credit/register')
    .send({ customerId: 'CUST-300', documentNo: 'IADE-001', amount: 500 });

  assert.equal(response.status, 500);
  assert.equal(response.body.error, 'Database client unavailable');
});
