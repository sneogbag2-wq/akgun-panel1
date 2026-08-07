import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import express from 'express';
import { createPromissoryNoteRouter } from '../promissoryNoteRouter.js';

test('promissoryNoteRouter - Creates draft and calculates installment breakdown with remainder', async () => {
  let createdDraft = null;
  let createdInstallments = [];

  const mockClient = {
    from(table) {
      if (table === 'promissory_note_draft') {
        return {
          insert(draft) {
            createdDraft = { id: 'draft-101', ...draft };
            return {
              select() {
                return {
                  single() {
                    return Promise.resolve({ data: createdDraft, error: null });
                  }
                };
              }
            };
          }
        };
      }
      if (table === 'promissory_note_installment') {
        return {
          insert(installments) {
            createdInstallments = installments;
            return {
              select() {
                return Promise.resolve({ data: installments, error: null });
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
  app.use('/instruments/promissory-note', createPromissoryNoteRouter({ clients: { serviceClient: mockClient } }));

  // Total 1000, 3 installments -> base: 333.33 * 3 = 999.99, remainder: 0.01 added to last -> 333.34
  const response = await request(app)
    .post('/instruments/promissory-note/create-draft')
    .send({
      customerId: 'CUST-500',
      totalAmount: 1000,
      installmentCount: 3,
      startDate: '2026-09-01'
    });

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.draft.customer_id, 'CUST-500');
  assert.equal(createdInstallments.length, 3);
  assert.equal(createdInstallments[0].amount, 333.33);
  assert.equal(createdInstallments[1].amount, 333.33);
  assert.equal(createdInstallments[2].amount, 333.34);
  assert.equal(createdInstallments[0].due_date, '2026-09-01');
});

test('promissoryNoteRouter - Returns 400 when required fields are missing', async () => {
  const app = express();
  app.use(express.json());
  app.use('/instruments/promissory-note', createPromissoryNoteRouter({ clients: { serviceClient: {} } }));

  const response = await request(app)
    .post('/instruments/promissory-note/create-draft')
    .send({ customerId: 'CUST-500' }); // missing totalAmount

  assert.equal(response.status, 400);
  assert.equal(response.body.error, 'customerId and totalAmount are required');
});

test('promissoryNoteRouter - Returns 500 when DB client is unavailable', async () => {
  const app = express();
  app.use(express.json());
  app.use('/instruments/promissory-note', createPromissoryNoteRouter({ clients: {} }));

  const response = await request(app)
    .post('/instruments/promissory-note/create-draft')
    .send({ customerId: 'CUST-500', totalAmount: 1000 });

  assert.equal(response.status, 500);
  assert.equal(response.body.error, 'Database client unavailable');
});
