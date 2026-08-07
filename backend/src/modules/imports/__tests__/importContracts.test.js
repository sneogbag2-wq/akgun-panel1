import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ImportContractError,
  canonicalJson,
  createScopeKey,
  normalizeValidationIssue,
  parseInitiateImportRequest,
  requestFingerprint,
} from '../importContracts.js';
import { createAnonymousImportFixture } from '../../../test/anonymousImportFixtures.js';
import { loadRuntimeConfig } from '../../../config/env.js';

test('canonical request fingerprint ignores object key order without coercing source text', () => {
  const first = { scope: { period: '2025-01', dealerRef: 'ANON_DEALER_0001' }, sourceKind: 'SYNTHETIC_TEST' };
  const second = { sourceKind: 'SYNTHETIC_TEST', scope: { dealerRef: 'ANON_DEALER_0001', period: '2025-01' } };
  assert.equal(canonicalJson(first), canonicalJson(second));
  assert.equal(requestFingerprint(first), requestFingerprint(second));
  assert.match(createScopeKey('SYNTHETIC_TEST', first.scope), /^SYNTHETIC_TEST:[a-f0-9]{64}$/);
});

test('initiation preserves declared hash and does not coerce fixture source values', () => {
  const fixture = createAnonymousImportFixture();
  const input = parseInitiateImportRequest(fixture.initiateBody);
  assert.equal(input.declaredSha256, fixture.initiateBody.declaredSha256);
  assert.equal(fixture.rawRow.cells.A1.rawValue, '0000123');
  assert.equal(fixture.rawRow.cells.B1.rawValue, '-1.25');
  assert.equal(fixture.rawRow.cells.C1.displayValue, '01.02.2025');
});

test('initiation rejects invalid hash, source kind, idempotency key and unsafe byte size', () => {
  const fixture = createAnonymousImportFixture();
  assert.throws(() => parseInitiateImportRequest({ ...fixture.initiateBody, declaredSha256: 'not-a-hash' }), ImportContractError);
  assert.throws(() => parseInitiateImportRequest({ ...fixture.initiateBody, sourceKind: 'sellout' }), ImportContractError);
  assert.throws(() => parseInitiateImportRequest({ ...fixture.initiateBody, idempotencyKey: 'short' }), ImportContractError);
  assert.throws(() => parseInitiateImportRequest({ ...fixture.initiateBody, byteSize: Number.MAX_SAFE_INTEGER + 1 }), ImportContractError);
});

test('validation issue enforces the Package 00 blocking invariant and one-based source row', () => {
  const issue = normalizeValidationIssue({
    severity: 'BLOCKING',
    blocksPublication: true,
    messageKey: 'imports.synthetic.blocked',
    sourceRef: { fileId: 'source-file', sheetName: 'Synthetic', rowNumber: 1 },
  });
  assert.equal(issue.blocksPublication, true);
  assert.throws(() => normalizeValidationIssue({ severity: 'BLOCKING', blocksPublication: false, messageKey: 'invalid' }), ImportContractError);
  assert.throws(() => normalizeValidationIssue({
    severity: 'WARNING', blocksPublication: false, messageKey: 'invalid',
    sourceRef: { fileId: 'source-file', sheetName: 'Synthetic', rowNumber: 0 },
  }), ImportContractError);
});

test('server configuration has no APP_SECRET fallback and accepts only explicit local values', () => {
  const completeEnv = {
    APP_SECRET: 'test-only-secret',
    SUPABASE_URL: 'http://127.0.0.1:54321',
    SUPABASE_ANON_KEY: 'anon-test-key',
    SUPABASE_SERVICE_ROLE_KEY: 'service-test-key',
  };
  assert.equal(loadRuntimeConfig(completeEnv).appSecret, 'test-only-secret');
  assert.throws(() => loadRuntimeConfig({ ...completeEnv, APP_SECRET: '' }), /MISSING_REQUIRED_ENV:APP_SECRET/);
});
