import { createHash } from 'node:crypto';

const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const SOURCE_KIND_PATTERN = /^[A-Z][A-Z0-9_]{1,127}$/;
const ID_PATTERN = /^[A-Za-z0-9._:-]{8,200}$/;

export class ImportContractError extends Error {
  constructor(code, messageKey, details) {
    super(code);
    this.name = 'ImportContractError';
    this.code = code;
    this.messageKey = messageKey;
    this.details = details;
    this.status = 422;
  }
}

export class ImportOperationError extends Error {
  constructor(code, messageKey, status, { retryable = false, details } = {}) {
    super(code);
    this.name = 'ImportOperationError';
    this.code = code;
    this.messageKey = messageKey;
    this.status = status;
    this.retryable = retryable;
    this.details = details;
  }
}

function fail(code, messageKey, details) {
  throw new ImportContractError(code, messageKey, details);
}

function requiredText(value, field, { maxLength = 512, pattern } = {}) {
  if (typeof value !== 'string') fail('INVALID_REQUEST', 'imports.request.invalidField', { field });
  const trimmed = value.trim();
  if (trimmed === '' || trimmed.length > maxLength || (pattern && !pattern.test(trimmed))) {
    fail('INVALID_REQUEST', 'imports.request.invalidField', { field });
  }
  return trimmed;
}

function nonNegativeSafeInteger(value, field) {
  if (!Number.isSafeInteger(value) || value < 0) {
    fail('INVALID_REQUEST', 'imports.request.invalidField', { field });
  }
  return value;
}

export function canonicalJson(value) {
  if (value === null) return 'null';
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) fail('INVALID_REQUEST', 'imports.request.invalidJsonValue');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (typeof value === 'object') {
    const keys = Object.keys(value).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  fail('INVALID_REQUEST', 'imports.request.invalidJsonValue');
}

export function sha256Hex(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function requestFingerprint(value) {
  return sha256Hex(canonicalJson(value));
}

export function createScopeKey(sourceKind, scope) {
  return `${sourceKind}:${sha256Hex(canonicalJson(scope))}`;
}

export function parseInitiateImportRequest(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    fail('INVALID_REQUEST', 'imports.request.invalidBody');
  }
  if (!body.scope || typeof body.scope !== 'object' || Array.isArray(body.scope)) {
    fail('INVALID_REQUEST', 'imports.request.invalidField', { field: 'scope' });
  }

  const sourceKind = requiredText(body.sourceKind, 'sourceKind', { maxLength: 128, pattern: SOURCE_KIND_PATTERN });
  const declaredSha256 = requiredText(body.declaredSha256, 'declaredSha256', { maxLength: 64, pattern: SHA256_PATTERN });
  const parsed = Object.freeze({
    sourceKind,
    originalFileName: requiredText(body.originalFileName, 'originalFileName', { maxLength: 255 }),
    byteSize: nonNegativeSafeInteger(body.byteSize, 'byteSize'),
    mimeType: requiredText(body.mimeType, 'mimeType', { maxLength: 255 }),
    declaredSha256,
    scope: body.scope,
    idempotencyKey: requiredText(body.idempotencyKey, 'idempotencyKey', { maxLength: 200, pattern: ID_PATTERN }),
  });
  return parsed;
}

export function parseIdempotencyRequest(body, requiredFields = []) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    fail('INVALID_REQUEST', 'imports.request.invalidBody');
  }
  for (const field of requiredFields) {
    if (body[field] === undefined || body[field] === null || body[field] === '') {
      fail('INVALID_REQUEST', 'imports.request.invalidField', { field });
    }
  }
  return Object.freeze({
    ...body,
    idempotencyKey: requiredText(body.idempotencyKey, 'idempotencyKey', { maxLength: 200, pattern: ID_PATTERN }),
  });
}

export function parseUuid(value, field) {
  return requiredText(value, field, {
    maxLength: 36,
    pattern: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  });
}

export function parseExpectedSnapshotVersion(value) {
  if (!Number.isSafeInteger(value) || value < 0) {
    fail('INVALID_REQUEST', 'imports.request.invalidField', { field: 'expectedSnapshotVersion' });
  }
  return value;
}

export function normalizeValidationIssue(issue) {
  const severity = requiredText(issue?.severity, 'severity', {
    maxLength: 16,
    pattern: /^(INFO|WARNING|ERROR|BLOCKING)$/,
  });
  const blocksPublication = issue?.blocksPublication;
  if (typeof blocksPublication !== 'boolean' || (severity === 'BLOCKING') !== blocksPublication) {
    fail('INVALID_ISSUE', 'imports.issue.invalidBlockingInvariant');
  }
  const sourceRef = issue?.sourceRef;
  if (sourceRef !== undefined) {
    if (!sourceRef || typeof sourceRef !== 'object'
      || typeof sourceRef.fileId !== 'string'
      || typeof sourceRef.sheetName !== 'string'
      || !Number.isSafeInteger(sourceRef.rowNumber)
      || sourceRef.rowNumber <= 0) {
      fail('INVALID_ISSUE', 'imports.issue.invalidSourceRef');
    }
  }
  return Object.freeze({
    severity,
    blocksPublication,
    messageKey: requiredText(issue?.messageKey, 'messageKey', { maxLength: 255 }),
    affectedField: issue?.affectedField === undefined ? undefined : requiredText(issue.affectedField, 'affectedField'),
    sourceRef,
    details: issue?.details && typeof issue.details === 'object' && !Array.isArray(issue.details)
      ? issue.details
      : {},
  });
}

export function toErrorEnvelope(error, correlationId) {
  const known = error instanceof ImportContractError || error instanceof ImportOperationError;
  const status = known ? error.status : 500;
  return {
    status,
    body: {
      code: known ? error.code : 'INTERNAL_ERROR',
      messageKey: known ? error.messageKey : 'imports.internalError',
      correlationId,
      retryable: known ? Boolean(error.retryable) : false,
      ...(known && error.details !== undefined ? { details: error.details } : {}),
    },
  };
}
