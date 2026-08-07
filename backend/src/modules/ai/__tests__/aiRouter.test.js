import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import express from 'express';
import { createAiRouter } from '../aiRouter.js';

test('aiRouter - Returns 500 when no API keys are configured', async () => {
  const app = express();
  app.use(express.json());
  app.use('/ai', createAiRouter());

  const response = await request(app)
    .post('/ai/chat')
    .send({ userMessage: 'Merhaba' });

  assert.equal(response.status, 500);
  assert.equal(typeof response.body.error, 'string');
});
