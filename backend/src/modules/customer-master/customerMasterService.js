import { parseExpectedSnapshotVersion, parseIdempotencyRequest, parseUuid, requestFingerprint } from '../imports/importContracts.js';
import {
  CUSTOMER_MASTER_PARSER_VERSION,
  CUSTOMER_MASTER_SOURCE_KIND,
  CustomerMasterContractError,
  parseAsOf,
  parseIssueState,
  parseOptionalFilter,
  parseOrganizationScope,
  parsePositiveInt,
} from './customerMasterContract.js';
import { parseCustomerMasterWorkbook } from './customerMasterParser.js';

function requiredCode(value) {
  if (typeof value !== 'string' || !/^500[0-9]+$/u.test(value)) {
    throw new CustomerMasterContractError('INVALID_CUSTOMER_CODE', 'customerMaster.request.invalidCustomerCode');
  }
  return value;
}

function optionalUuid(value, field) {
  return value === undefined || value === '' ? null : parseUuid(value, field);
}

export function createCustomerMasterService(repository) {
  if (!repository) throw new TypeError('Customer master repository is required');
  return Object.freeze({
    async parse(batchId, correlationId) {
      parseUuid(batchId, 'batchId');
      const batch = await repository.getImport(batchId);
      if (batch.source_kind !== CUSTOMER_MASTER_SOURCE_KIND) {
        throw new CustomerMasterContractError('SOURCE_KIND_MISMATCH', 'customerMaster.import.sourceKindMismatch');
      }
      const workbook = parseCustomerMasterWorkbook(await repository.readSourceBytes(batch.storage_object_path));
      return repository.parse({ batchId, rows: workbook.records, parserVersion: workbook.parserVersion, correlationId });
    },
    validate(batchId, correlationId) {
      parseUuid(batchId, 'batchId');
      return repository.validate({ batchId, correlationId });
    },
    publish(batchId, body, correlationId) {
      parseUuid(batchId, 'batchId');
      const input = parseIdempotencyRequest(body, ['expectedValidationRunId', 'expectedSnapshotVersion']);
      const expectedValidationRunId = parseUuid(input.expectedValidationRunId, 'expectedValidationRunId');
      const expectedSnapshotVersion = parseExpectedSnapshotVersion(input.expectedSnapshotVersion);
      const businessEffectiveAt = parseAsOf(input.businessEffectiveAt);
      return repository.publish({
        batchId,
        expectedValidationRunId,
        expectedSnapshotVersion,
        idempotencyKey: input.idempotencyKey,
        requestFingerprint: requestFingerprint({ batchId, expectedValidationRunId, expectedSnapshotVersion, businessEffectiveAt: businessEffectiveAt ?? null }),
        businessEffectiveAt,
        correlationId,
      });
    },
    list(query) {
      return repository.list({
        asOf: parseAsOf(query.asOf),
        status: typeof query.status === 'string' ? query.status : null,
        channel: typeof query.channel === 'string' ? query.channel : null,
        segment: typeof query.segment === 'string' ? query.segment : null,
        repId: optionalUuid(query.repId, 'repId'),
        ssmId: optionalUuid(query.ssmId, 'ssmId'),
        resolutionState: typeof query.resolutionState === 'string' ? query.resolutionState : null,
        page: parsePositiveInt(query.page, 1, 10_000),
        pageSize: parsePositiveInt(query.pageSize, 50, 100),
      });
    },
    customer(customerCode, query) { return repository.customer(requiredCode(customerCode), parseAsOf(query.asOf)); },
    history(customerCode) { return repository.history(requiredCode(customerCode)); },
    organization(kind, query) {
      return repository.organization(kind, {
        asOf: parseAsOf(query.asOf),
        scope: parseOrganizationScope(query.scope),
        code: parseOptionalFilter(query.code, 'code'),
        state: parseIssueState(query.state),
        page: parsePositiveInt(query.page, 1, 10_000),
        pageSize: parsePositiveInt(query.pageSize, 50, 100),
      });
    },
    reconciliation(snapshotId) { return repository.reconciliation(parseUuid(snapshotId, 'snapshotId')); },
    parserVersion: CUSTOMER_MASTER_PARSER_VERSION,
  });
}
