import {
  ImportContractError,
  ImportOperationError,
  createScopeKey,
  parseExpectedSnapshotVersion,
  parseIdempotencyRequest,
  parseInitiateImportRequest,
  parseUuid,
  requestFingerprint,
  sha256Hex,
} from './importContracts.js';

function nonBlankString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new ImportContractError('INVALID_REQUEST', 'imports.request.invalidField', { field });
  }
  return value.trim();
}

function parsePage(value, fallback) {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) {
    throw new ImportContractError('INVALID_REQUEST', 'imports.request.invalidPagination');
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed > 1000) {
    throw new ImportContractError('INVALID_REQUEST', 'imports.request.invalidPagination');
  }
  return parsed;
}

export function createImportService(repository) {
  if (!repository) throw new TypeError('Import repository is required');

  return Object.freeze({
    async initiate(body) {
      const input = parseInitiateImportRequest(body);
      const scopeKey = createScopeKey(input.sourceKind, input.scope);
      const fingerprint = requestFingerprint({
        sourceKind: input.sourceKind,
        originalFileName: input.originalFileName,
        byteSize: input.byteSize,
        mimeType: input.mimeType,
        declaredSha256: input.declaredSha256,
        scope: input.scope,
      });
      const initiated = await repository.initiate({
        ...input,
        scopeKey,
        requestFingerprint: fingerprint,
      });
      const upload = await repository.createSignedUpload(initiated.storageObjectPath);
      return Object.freeze({
        batchId: initiated.batchId,
        status: initiated.status,
        idempotentReplay: Boolean(initiated.idempotentReplay),
        upload: {
          signedUrl: upload.signedUrl,
          expiresInSeconds: upload.expiresInSeconds,
        },
      });
    },

    async completeUpload(batchId, correlationId) {
      parseUuid(batchId, 'batchId');
      const batch = await repository.getImport(batchId);
      const bytes = await repository.readObjectBytes(batch.storage_object_path ?? batch.storageObjectPath);
      const result = await repository.completeUpload({
        batchId,
        sha256: sha256Hex(bytes),
        byteSize: bytes.byteLength,
        correlationId,
      });
      if (result.code === 'HASH_OR_SIZE_MISMATCH') {
        throw new ImportOperationError('HASH_OR_SIZE_MISMATCH', 'imports.upload.hashMismatch', 422, {
          details: { batchId },
        });
      }
      return result;
    },

    async validate(batchId, correlationId) {
      parseUuid(batchId, 'batchId');
      const batch = await repository.getImport(batchId);
      if (batch.status === 'HASH_VERIFIED') {
        throw new ImportOperationError('PARSER_NOT_AVAILABLE', 'imports.parser.notAvailableInPackage01', 422);
      }
      return repository.validate({ batchId, correlationId });
    },

    async getImport(batchId) {
      parseUuid(batchId, 'batchId');
      return repository.getImport(batchId);
    },

    async getIssues(batchId, query) {
      parseUuid(batchId, 'batchId');
      return repository.getIssues(batchId, {
        page: parsePage(query.page, 1),
        pageSize: Math.min(parsePage(query.pageSize, 50), 100),
      });
    },

    async review(batchId, body, correlationId) {
      parseUuid(batchId, 'batchId');
      const input = parseIdempotencyRequest(body, ['decision', 'reason']);
      const decision = nonBlankString(input.decision, 'decision');
      if (!['APPROVE', 'REJECT'].includes(decision)) {
        throw new ImportContractError('INVALID_REQUEST', 'imports.review.invalidDecision', { field: 'decision' });
      }
      const reason = nonBlankString(input.reason, 'reason');
      return repository.review({
        batchId,
        decision,
        reason,
        idempotencyKey: input.idempotencyKey,
        requestFingerprint: requestFingerprint({ batchId, decision, reason }),
        correlationId,
      });
    },

    async publish(batchId, body, correlationId) {
      parseUuid(batchId, 'batchId');
      const input = parseIdempotencyRequest(body, ['expectedValidationRunId', 'expectedSnapshotVersion']);
      const expectedValidationRunId = parseUuid(input.expectedValidationRunId, 'expectedValidationRunId');
      const expectedSnapshotVersion = parseExpectedSnapshotVersion(input.expectedSnapshotVersion);
      return repository.publish({
        batchId,
        expectedValidationRunId,
        expectedSnapshotVersion,
        idempotencyKey: input.idempotencyKey,
        requestFingerprint: requestFingerprint({ batchId, expectedValidationRunId, expectedSnapshotVersion }),
        correlationId,
      });
    },

    async getCurrentPublication(query) {
      const sourceKind = nonBlankString(query.sourceKind, 'sourceKind');
      const scopeKey = nonBlankString(query.scopeKey, 'scopeKey');
      return repository.getCurrentPublication({ sourceKind, scopeKey });
    },
  });
}
