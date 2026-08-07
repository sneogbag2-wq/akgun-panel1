import { ImportOperationError } from './importContracts.js';

function mapSupabaseError(error) {
  const code = error?.message || error?.code || 'SUPABASE_ERROR';
  const validationCodes = new Set([
    'BLOCKING_VALIDATION_ISSUES',
    'VALIDATION_CONTROL_TOTAL_MISMATCH',
    'EMPTY_SNAPSHOT_NOT_ALLOWED',
    'VALIDATION_NOT_SUCCEEDED',
    'PARSER_NOT_COMPLETED',
    'REVIEW_REASON_REQUIRED',
    'INVALID_REVIEW_DECISION',
  ]);
  const conflictCodes = new Set([
    'IDEMPOTENCY_CONFLICT',
    'STALE_VALIDATION_RUN',
    'STALE_ACTIVE_SNAPSHOT',
    'PUBLISH_NOT_ALLOWED',
    'REVIEW_NOT_ALLOWED',
    'INVALID_IMPORT_STATE_TRANSITION',
  ]);
  const status = error?.code === '42501' ? 403
    : validationCodes.has(code) ? 422
      : conflictCodes.has(code) || ['P0001', '55000'].includes(error?.code) ? 409
        : error?.code === 'P0002' ? 404 : 503;
  return new ImportOperationError(code, 'imports.repository.operationFailed', status, {
    retryable: status === 503,
  });
}

async function requireData(operation) {
  const { data, error } = await operation;
  if (error) throw mapSupabaseError(error);
  return data;
}

export function createImportRepository({ userClient, serviceClient, signedUrlTtlSeconds }) {
  if (!userClient?.rpc || !serviceClient?.storage) {
    throw new TypeError('User and service Supabase clients are required');
  }

  return Object.freeze({
    async initiate(input) {
      return requireData(userClient.rpc('initiate_import_batch', {
        p_source_kind: input.sourceKind,
        p_original_file_name: input.originalFileName,
        p_declared_byte_size: input.byteSize,
        p_mime_type: input.mimeType,
        p_declared_sha256: input.declaredSha256,
        p_scope_payload: input.scope,
        p_scope_key: input.scopeKey,
        p_idempotency_key: input.idempotencyKey,
        p_request_fingerprint: input.requestFingerprint,
      }));
    },

    async createSignedUpload(storageObjectPath) {
      const { data, error } = await serviceClient.storage
        .from('source-imports')
        .createSignedUploadUrl(storageObjectPath, { upsert: false });
      if (error || !data?.signedUrl) throw mapSupabaseError(error);
      return Object.freeze({
        signedUrl: data.signedUrl,
        path: storageObjectPath,
        expiresInSeconds: signedUrlTtlSeconds,
      });
    },

    async readObjectBytes(storageObjectPath) {
      const { data, error } = await serviceClient.storage.from('source-imports').download(storageObjectPath);
      if (error || !data) throw mapSupabaseError(error);
      return Buffer.from(await data.arrayBuffer());
    },

    async completeUpload({ batchId, sha256, byteSize, correlationId }) {
      return requireData(userClient.rpc('complete_import_upload', {
        p_batch_id: batchId,
        p_server_sha256: sha256,
        p_server_byte_size: byteSize,
        p_correlation_id: correlationId,
      }));
    },

    async getImport(batchId) {
      const data = await requireData(userClient
        .from('import_batches')
        .select('id,source_kind,scope_key,storage_object_path,status,read_row_count,valid_row_count,invalid_row_count,active_validation_run_id,duplicate_of_batch_id,created_at,updated_at')
        .eq('id', batchId)
        .maybeSingle());
      if (!data) throw new ImportOperationError('IMPORT_NOT_FOUND', 'imports.notFound', 404);
      return data;
    },

    async getIssues(batchId, { page = 1, pageSize = 50 } = {}) {
      const importBatch = await this.getImport(batchId);
      if (!importBatch.active_validation_run_id) return Object.freeze({ items: [], page, pageSize });
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      const data = await requireData(userClient
        .from('data_quality_issues')
        .select('id,severity,blocks_publication,message_key,details,affected_field,source_ref,created_at')
        .eq('validation_run_id', importBatch.active_validation_run_id)
        .order('created_at', { ascending: true })
        .range(from, to));
      return Object.freeze({ items: data, page, pageSize });
    },

    async validate({ batchId, correlationId }) {
      return requireData(userClient.rpc('start_import_validation', {
        p_batch_id: batchId,
        p_correlation_id: correlationId,
      }));
    },

    async review({ batchId, decision, reason, idempotencyKey, requestFingerprint, correlationId }) {
      return requireData(userClient.rpc('review_import_batch', {
        p_batch_id: batchId,
        p_decision: decision,
        p_reason: reason,
        p_idempotency_key: idempotencyKey,
        p_request_fingerprint: requestFingerprint,
        p_correlation_id: correlationId,
      }));
    },

    async publish({ batchId, expectedValidationRunId, expectedSnapshotVersion, idempotencyKey, requestFingerprint, correlationId }) {
      return requireData(userClient.rpc('publish_import', {
        p_batch_id: batchId,
        p_expected_validation_run_id: expectedValidationRunId,
        p_expected_snapshot_version: expectedSnapshotVersion,
        p_idempotency_key: idempotencyKey,
        p_request_fingerprint: requestFingerprint,
        p_correlation_id: correlationId,
      }));
    },

    async getCurrentPublication({ sourceKind, scopeKey }) {
      const data = await requireData(userClient
        .from('publication_snapshots')
        .select('id,source_kind,scope_key,import_batch_id,validation_run_id,snapshot_version,published_at,control_totals')
        .eq('source_kind', sourceKind)
        .eq('scope_key', scopeKey)
        .eq('is_active', true)
        .maybeSingle());
      if (!data) throw new ImportOperationError('PUBLICATION_NOT_FOUND', 'imports.publication.notFound', 404);
      return data;
    },
  });
}
