import { ImportOperationError } from '../imports/importContracts.js';

function mapError(error) {
  const code = error?.message || error?.code || 'SUPABASE_ERROR';
  const status = error?.code === '42501' ? 403 : error?.code === 'P0002' ? 404 : ['P0001', '40001', '55000'].includes(error?.code) ? 409 : error?.code === '22023' ? 422 : 503;
  return new ImportOperationError(code, 'products.repository.operationFailed', status, { retryable: status === 503 });
}
async function data(operation) { const { data: value, error } = await operation; if (error) throw mapError(error); return value; }

export function createProductResolutionRepository({ userClient, serviceClient }) {
  if (!userClient?.rpc || !userClient?.from || !serviceClient?.storage) throw new TypeError('Product repository requires user and service clients');
  return Object.freeze({
    async getImport(batchId) { const result = await data(userClient.from('import_batches').select('id,source_kind,storage_object_path,status,active_validation_run_id').eq('id', batchId).maybeSingle()); if (!result) throw new ImportOperationError('IMPORT_NOT_FOUND', 'products.import.notFound', 404); return result; },
    async readSourceBytes(path) { const { data: blob, error } = await serviceClient.storage.from('source-imports').download(path); if (error || !blob) throw mapError(error); return Buffer.from(await blob.arrayBuffer()); },
    parse: ({ batchId, rows, parserVersion, correlationId }) => data(userClient.rpc('parse_package_conversion_batch', { p_batch_id: batchId, p_rows: rows, p_parser_version: parserVersion, p_correlation_id: correlationId })),
    validate: ({ batchId, correlationId, graphIssues }) => data(userClient.rpc('validate_package_conversion_batch', { p_batch_id: batchId, p_correlation_id: correlationId, p_graph_issues: graphIssues })),
    publish: (input) => data(userClient.rpc('publish_package_conversion_batch', { p_batch_id: input.batchId, p_expected_validation_run_id: input.expectedValidationRunId, p_expected_snapshot_version: input.expectedSnapshotVersion, p_idempotency_key: input.idempotencyKey, p_request_fingerprint: input.requestFingerprint, p_correlation_id: input.correlationId })),
    variants: (query) => data(userClient.rpc('product_variants_list_v2', { p_query: query.query, p_family_id: query.familyId, p_conversion_status: query.conversionStatus, p_as_of: query.asOf, p_page: query.page, p_page_size: query.pageSize })),
    families: (query) => data(userClient.rpc('product_families_list_v2', { p_as_of: query.asOf, p_resolution_state: query.resolutionState, p_volume_status: query.volumeStatus, p_page: query.page, p_page_size: query.pageSize })),
    family: (familyId, asOf) => data(userClient.rpc('product_family_detail_v2', { p_family_id: familyId, p_as_of: asOf })),
    graph: (familyId, asOf) => data(userClient.rpc('product_conversion_graph_v2', { p_family_id: familyId, p_as_of: asOf })),
    coverage: (asOf, sourceKind) => data(userClient.rpc('product_litre_coverage_v2', { p_as_of: asOf, p_source_kind: sourceKind })),
    exceptions: (query) => data(userClient.rpc('product_exceptions_list_v2', { p_code: query.code, p_state: query.state, p_family_id: query.familyId, p_page: query.page, p_page_size: query.pageSize })),
    preview: (issueId, proposal) => data(userClient.rpc('product_resolution_preview_v2', { p_issue_id: issueId, p_proposal: proposal })),
    commit: (issueId, proposal, reason) => data(userClient.rpc('commit_product_resolution_v2', { p_issue_id: issueId, p_proposal: proposal, p_reason: reason })),
    revert: (resolutionId, reason) => data(userClient.rpc('revert_product_resolution_v2', { p_resolution_id: resolutionId, p_reason: reason })),
    reconciliation: (runId) => data(userClient.rpc('product_resolution_reconciliation_v2', { p_run_id: runId })),
  });
}
