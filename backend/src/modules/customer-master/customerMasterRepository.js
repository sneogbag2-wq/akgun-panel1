import { ImportOperationError } from '../imports/importContracts.js';

function mapSupabaseError(error) {
  const code = error?.message || error?.code || 'SUPABASE_ERROR';
  const status = error?.code === '42501' ? 403
    : error?.code === 'P0002' ? 404
      : ['P0001', '40001', '55000'].includes(error?.code) ? 409
        : ['22023'].includes(error?.code) ? 422 : 503;
  return new ImportOperationError(code, 'customerMaster.repository.operationFailed', status, { retryable: status === 503 });
}

async function requireData(operation) {
  const { data, error } = await operation;
  if (error) throw mapSupabaseError(error);
  return data;
}

export function createCustomerMasterRepository({ userClient, serviceClient }) {
  if (!userClient?.rpc || !userClient?.from || !serviceClient?.storage) {
    throw new TypeError('Customer master repository requires user and service clients');
  }
  return Object.freeze({
    async getImport(batchId) {
      const data = await requireData(userClient.from('import_batches')
        .select('id,source_kind,scope_key,storage_object_path,status,active_validation_run_id')
        .eq('id', batchId).maybeSingle());
      if (!data) throw new ImportOperationError('IMPORT_NOT_FOUND', 'customerMaster.import.notFound', 404);
      return data;
    },
    async readSourceBytes(storageObjectPath) {
      const { data, error } = await serviceClient.storage.from('source-imports').download(storageObjectPath);
      if (error || !data) throw mapSupabaseError(error);
      return Buffer.from(await data.arrayBuffer());
    },
    parse({ batchId, rows, parserVersion, correlationId }) {
      return requireData(userClient.rpc('parse_customer_master_batch', {
        p_batch_id: batchId, p_rows: rows, p_parser_version: parserVersion, p_correlation_id: correlationId,
      }));
    },
    validate({ batchId, correlationId }) {
      return requireData(userClient.rpc('validate_customer_master_batch', { p_batch_id: batchId, p_correlation_id: correlationId }));
    },
    publish({ batchId, expectedValidationRunId, expectedSnapshotVersion, idempotencyKey, requestFingerprint, businessEffectiveAt, correlationId }) {
      return requireData(userClient.rpc('publish_customer_master_batch', {
        p_batch_id: batchId,
        p_expected_validation_run_id: expectedValidationRunId,
        p_expected_snapshot_version: expectedSnapshotVersion,
        p_idempotency_key: idempotencyKey,
        p_request_fingerprint: requestFingerprint,
        p_business_effective_at: businessEffectiveAt,
        p_correlation_id: correlationId,
      }));
    },
    list(query) {
      return requireData(userClient.rpc('customer_master_list_v2', {
        p_as_of: query.asOf,
        p_status: query.status,
        p_channel: query.channel,
        p_segment: query.segment,
        p_rep_id: query.repId,
        p_ssm_id: query.ssmId,
        p_resolution_state: query.resolutionState,
        p_page: query.page,
        p_page_size: query.pageSize,
      }));
    },
    customer(customerCode, asOf) {
      return requireData(userClient.rpc('customer_master_customer_v2', { p_customer_code: customerCode, p_as_of: asOf }));
    },
    history(customerCode) {
      return requireData(userClient.rpc('customer_master_history_v2', { p_customer_code: customerCode }));
    },
    organization(kind, query) {
      return requireData(userClient.rpc('customer_master_organization_v2', {
        p_kind: kind,
        p_as_of: query.asOf,
        p_scope: query.scope,
        p_issue_code: query.code,
        p_issue_state: query.state,
        p_page: query.page,
        p_page_size: query.pageSize,
      }));
    },
    reconciliation(snapshotId) {
      return requireData(userClient.rpc('customer_master_reconciliation_v2', { p_snapshot_id: snapshotId }));
    },
  });
}
