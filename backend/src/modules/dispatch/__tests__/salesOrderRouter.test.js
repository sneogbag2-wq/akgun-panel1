import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import express from 'express';
import { createSalesOrderRouter } from '../salesOrderRouter.js';

test('salesOrderRouter - Returns active sales orders list', async () => {
  const mockClient = {
    from(table) {
      if (table === 'sales_order_document') {
        return {
          select() {
            return {
              eq(col, val) {
                return Promise.resolve({
                  data: [{ id: 'so-1', sales_document_no: 'SO-1001', customer_id: 'CUST-10', total_amount: 15000, is_active: true }],
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
  app.use('/dispatch/sales-orders', createSalesOrderRouter({ clients: { serviceClient: mockClient } }));

  const response = await request(app).get('/dispatch/sales-orders/active');
  assert.equal(response.status, 200);
  assert.equal(response.body.data.length, 1);
  assert.equal(response.body.data[0].sales_document_no, 'SO-1001');
});

test('salesOrderRouter - Publishes sales orders successfully', async () => {
  let insertedOrders = [];
  const mockClient = {
    from(table) {
      if (table === 'sales_order_document') {
        return {
          upsert(header) {
            insertedOrders.push(header);
            return {
              select() {
                return {
                  single() {
                    return Promise.resolve({ data: { id: 'so-2001', ...header }, error: null });
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
  app.use('/dispatch/sales-orders', createSalesOrderRouter({ clients: { serviceClient: mockClient } }));

  const response = await request(app)
    .post('/dispatch/sales-orders/publish')
    .send({
      orders: [
        { salesDocumentNo: 'SO-2001', customerId: 'CUST-20', totalAmount: 8000 }
      ]
    });

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.publishedDocumentsCount, 1);
});

test('salesOrderRouter - Returns 500 when DB client is unavailable', async () => {
  const app = express();
  app.use('/dispatch/sales-orders', createSalesOrderRouter({ clients: {} }));

  const response = await request(app).get('/dispatch/sales-orders/active');
  assert.equal(response.status, 500);
  assert.equal(response.body.error, 'Database client unavailable');
});
