import test from 'node:test';
import assert from 'node:assert/strict';
import supertest from 'supertest';
import { createImportService } from '../importService.js';
import { ImportOperationError } from '../importContracts.js';
import { createApp } from '../../../../server.js';
import {
  anonymousBatchId,
  anonymousValidationRunId,
  createAnonymousImportFixture,
} from '../../../test/anonymousImportFixtures.js';

function createRepository({ status = 'INITIATED', completeResult } = {}) {
  const initiatedByKey = new Map();
  const calls = [];
  return {
    calls,
    async initiate(input) {
      const prior = initiatedByKey.get(input.idempotencyKey);
      if (prior && prior.fingerprint !== input.requestFingerprint) {
        throw new ImportOperationError('IDEMPOTENCY_CONFLICT', 'imports.idempotency.conflict', 409);
      }
      if (prior) return { ...prior.result, idempotentReplay: true };
      const result = { batchId: anonymousBatchId, status: 'INITIATED', storageObjectPath: 'imports/a/b' };
      initiatedByKey.set(input.idempotencyKey, { fingerprint: input.requestFingerprint, result });
      calls.push(['initiate', input]);
      return result;
    },
    async createSignedUpload(path) {
      calls.push(['sign', path]);
      return { signedUrl: 'https://local.example.test/signed-upload', expiresInSeconds: 300 };
    },
    async getImport() {
      return { id: anonymousBatchId, status, storage_object_path: 'imports/a/b' };
    },
    async readObjectBytes() {
      return createAnonymousImportFixture().bytes;
    },
    async completeUpload(input) {
      calls.push(['complete', input]);
      return completeResult ?? { batchId: anonymousBatchId, status: 'HASH_VERIFIED' };
    },
    async validate(input) {
      calls.push(['validate', input]);
      return { validationRunId: anonymousValidationRunId, status: 'VALIDATING' };
    },
    async getIssues() { return { items: [], page: 1, pageSize: 50 }; },
    async review(input) { calls.push(['review', input]); return { status: 'APPROVED' }; },
    async publish(input) { calls.push(['publish', input]); return { status: 'PUBLISHED' }; },
    async getCurrentPublication() { return { id: 'snapshot' }; },
  };
}

test('same idempotency key and body returns an idempotent initiation result', async () => {
  const fixture = createAnonymousImportFixture();
  const repository = createRepository();
  const service = createImportService(repository);
  const first = await service.initiate(fixture.initiateBody);
  const second = await service.initiate(fixture.initiateBody);
  assert.equal(first.batchId, anonymousBatchId);
  assert.equal(first.upload.signedUrl, 'https://local.example.test/signed-upload');
  assert.equal(second.idempotentReplay, true);
  assert.equal(repository.calls.filter(([name]) => name === 'initiate').length, 1);
});

test('same idempotency key with a different request is a 409 conflict', async () => {
  const fixture = createAnonymousImportFixture();
  const repository = createRepository();
  const service = createImportService(repository);
  await service.initiate(fixture.initiateBody);
  await assert.rejects(
    service.initiate({ ...fixture.initiateBody, originalFileName: 'different.xlsx' }),
    (error) => error.code === 'IDEMPOTENCY_CONFLICT' && error.status === 409,
  );
});

test('server byte verification returns no publish path when hash or byte size mismatches', async () => {
  const repository = createRepository({ completeResult: { code: 'HASH_OR_SIZE_MISMATCH', status: 'FAILED' } });
  const service = createImportService(repository);
  await assert.rejects(
    service.completeUpload(anonymousBatchId, 'correlation-id'),
    (error) => error.code === 'HASH_OR_SIZE_MISMATCH' && error.status === 422,
  );
  assert.equal(repository.calls.some(([name]) => name === 'publish'), false);
});

test('Package 01 has no real parser: validation is fail-closed until a later parser package', async () => {
  const repository = createRepository({ status: 'HASH_VERIFIED' });
  const service = createImportService(repository);
  await assert.rejects(
    service.validate(anonymousBatchId, 'correlation-id'),
    (error) => error.code === 'PARSER_NOT_AVAILABLE' && error.status === 422,
  );
  assert.equal(repository.calls.some(([name]) => name === 'validate'), false);
});

test('review requires a reason and publish pins validation and snapshot versions', async () => {
  const repository = createRepository({ status: 'REVIEW_REQUIRED' });
  const service = createImportService(repository);
  await assert.rejects(
    service.review(anonymousBatchId, { decision: 'APPROVE', reason: '', idempotencyKey: 'review-0001' }, 'c'),
    (error) => error.status === 422,
  );
  await service.publish(anonymousBatchId, {
    expectedValidationRunId: anonymousValidationRunId,
    expectedSnapshotVersion: 0,
    idempotencyKey: 'publish-0001',
  }, 'c');
  const publishCall = repository.calls.find(([name]) => name === 'publish')[1];
  assert.equal(publishCall.expectedValidationRunId, anonymousValidationRunId);
  assert.equal(publishCall.expectedSnapshotVersion, 0);
});

test('legacy health and app-secret routes remain separate from bearer-auth import routes', async () => {
  const previousBypass = process.env.ALLOW_DEV_AUTH_BYPASS;
  delete process.env.ALLOW_DEV_AUTH_BYPASS;
  
  const app = createApp({
    config: {
      appSecret: 'test-app-secret',
      supabaseUrl: 'http://127.0.0.1:54321',
      supabaseAnonKey: 'test-anon-key',
      supabaseServiceRoleKey: 'test-service-key',
      importSignedUrlTtlSeconds: 300,
    },
    supabaseClients: {
      authClient: {
        auth: {
          getUser: async (token) => {
            if (token === 'valid-token') return { data: { user: { id: 'test-user-id' } }, error: null };
            return { data: { user: null }, error: new Error('Invalid token') };
          },
        },
      },
      createUserClient: (token) => {
        if (token !== 'valid-token') throw new Error('must not create a user client without a bearer user');
        return { rpc: () => {} };
      },
      serviceClient: { storage: {} },
    },
  });
  const request = supertest(app);
  await request.get('/').expect(200);
  await request.get('/api/health').expect(200);
  await request.post('/api/ai/chat').send({}).expect(401);

  // Senaryo 1: Token yok (Eski beklenen 401)
  const noAuthResponse = await request.post('/api/v2/imports/initiate').send({}).expect(401);
  assert.equal(noAuthResponse.body.code, 'UNAUTHENTICATED');

  // Senaryo 2: Hatalı token
  const badAuthResponse = await request.post('/api/v2/imports/initiate').set('Authorization', 'Bearer bad-token').send({}).expect(401);
  assert.equal(badAuthResponse.body.code, 'UNAUTHENTICATED');

  // Senaryo 3: Doğru token (Auth bariyerini aşar, router'a girer, gövde boş olduğu için validation hatası 422 döner)
  const validAuthResponse = await request.post('/api/v2/imports/initiate').set('Authorization', 'Bearer valid-token').send({}).expect(422);
  assert.equal(validAuthResponse.body.code, 'INVALID_REQUEST');
});
