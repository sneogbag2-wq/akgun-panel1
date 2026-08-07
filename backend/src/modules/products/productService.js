import { parseExpectedSnapshotVersion, parseIdempotencyRequest, requestFingerprint } from '../imports/importContracts.js';
import { PACKAGE_CONVERSION_PARSER_VERSION, PACKAGE_CONVERSION_SOURCE_KIND, ProductContractError, parseAsOf, parsePositiveInt, parseUuid } from './productContract.js';
import { parsePackageConversionWorkbook } from './packageConversionParser.js';
import { resolveProductGraph } from './productGraphResolver.js';

const optionalUuid = (value, field) => value === undefined || value === '' ? null : parseUuid(value, field);
const optionalText = (value, field) => { if (value === undefined || value === '') return null; if (typeof value !== 'string' || !value.trim()) throw new ProductContractError('INVALID_FILTER', 'products.request.invalidFilter', { field }); return value.trim(); };
export function createProductService(repository, { parseWorkbook = parsePackageConversionWorkbook, resolveGraph = resolveProductGraph } = {}) {
  if (!repository) throw new TypeError('Product repository is required');
  return Object.freeze({
    async parse(batchId, correlationId) { parseUuid(batchId, 'batchId'); const batch = await repository.getImport(batchId); if (batch.source_kind !== PACKAGE_CONVERSION_SOURCE_KIND) throw new ProductContractError('SOURCE_KIND_MISMATCH', 'products.import.sourceKindMismatch'); const workbook = parseWorkbook(await repository.readSourceBytes(batch.storage_object_path)); return repository.parse({ batchId, rows: workbook.records, parserVersion: workbook.parserVersion, correlationId }); },
    async validate(batchId, correlationId) {
      const parsedBatchId = parseUuid(batchId, 'batchId');
      const batch = await repository.getImport(parsedBatchId);
      if (batch.source_kind !== PACKAGE_CONVERSION_SOURCE_KIND) throw new ProductContractError('SOURCE_KIND_MISMATCH', 'products.import.sourceKindMismatch');
      const workbook = parseWorkbook(await repository.readSourceBytes(batch.storage_object_path));
      const graph = resolveGraph(workbook.records.map((record) => record.parsedPayload));
      return repository.validate({ batchId: parsedBatchId, correlationId, graphIssues: graph.issues });
    },
    publish(batchId, body, correlationId) { const input = parseIdempotencyRequest(body, ['expectedValidationRunId', 'expectedSnapshotVersion']); const expectedValidationRunId = parseUuid(input.expectedValidationRunId, 'expectedValidationRunId'); const expectedSnapshotVersion = parseExpectedSnapshotVersion(input.expectedSnapshotVersion); return repository.publish({ batchId: parseUuid(batchId, 'batchId'), expectedValidationRunId, expectedSnapshotVersion, idempotencyKey: input.idempotencyKey, requestFingerprint: requestFingerprint({ batchId, expectedValidationRunId, expectedSnapshotVersion }), correlationId }); },
    variants(query) { return repository.variants({ query: optionalText(query.query, 'query'), familyId: optionalUuid(query.familyId, 'familyId'), conversionStatus: optionalText(query.conversionStatus, 'conversionStatus'), asOf: parseAsOf(query.asOf), page: parsePositiveInt(query.page, 1, 10_000), pageSize: parsePositiveInt(query.pageSize, 50, 100) }); },
    families(query) { return repository.families({ asOf: parseAsOf(query.asOf), resolutionState: optionalText(query.resolutionState, 'resolutionState'), volumeStatus: optionalText(query.volumeStatus, 'volumeStatus'), page: parsePositiveInt(query.page, 1, 10_000), pageSize: parsePositiveInt(query.pageSize, 50, 100) }); },
    family(familyId, query) { return repository.family(parseUuid(familyId, 'familyId'), parseAsOf(query.asOf)); },
    graph(familyId, query) { return repository.graph(parseUuid(familyId, 'familyId'), parseAsOf(query.asOf)); },
    coverage(query) { return repository.coverage(parseAsOf(query.asOf), optionalText(query.sourceKind, 'sourceKind')); },
    exceptions(query) { return repository.exceptions({ code: optionalText(query.code, 'code'), state: optionalText(query.state, 'state'), familyId: optionalUuid(query.familyId, 'familyId'), page: parsePositiveInt(query.page, 1, 10_000), pageSize: parsePositiveInt(query.pageSize, 50, 100) }); },
    preview(issueId, body) { return repository.preview(parseUuid(issueId, 'issueId'), body?.proposal); },
    commit(issueId, body) { return repository.commit(parseUuid(issueId, 'issueId'), body?.proposal, optionalText(body?.reason, 'reason')); },
    revert(resolutionId, body) { return repository.revert(parseUuid(resolutionId, 'resolutionId'), optionalText(body?.reason, 'reason')); },
    reconciliation(runId) { return repository.reconciliation(parseUuid(runId, 'runId')); },
    parserVersion: PACKAGE_CONVERSION_PARSER_VERSION,
  });
}
