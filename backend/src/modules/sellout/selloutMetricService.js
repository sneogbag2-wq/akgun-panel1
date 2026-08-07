import { parseUuid } from '../imports/importContracts.js';
import { SELLOUT_SOURCE_KIND, SelloutContractError, page, parsePublishRequest, parseMonth } from './selloutContract.js';
import { parseSelloutWorkbook } from './selloutParser.js';
import { buildSelloutPreview } from './selloutValidator.js';

export function createSelloutMetricService(repository, { parseWorkbook = parseSelloutWorkbook } = {}) {
  if (!repository) throw new TypeError('Sellout repository is required');
  
  const read = async (batchId) => {
    parseUuid(batchId, 'batchId');
    const batch = await repository.getImport(batchId);
    if (batch.source_kind !== SELLOUT_SOURCE_KIND) throw new SelloutContractError('SOURCE_KIND_MISMATCH');
    return { batch, workbook: parseWorkbook(await repository.readSourceBytes(batch.storage_object_path)) };
  };

  const previewHash = (body) => {
    if (typeof body?.previewHash !== 'string') throw new SelloutContractError('INVALID_RESOLUTION_PREVIEW');
    const { previewHash: hash, ...input } = body;
    return { hash, input };
  };

  return Object.freeze({
    async parse(batchId, correlationId) {
      const { workbook } = await read(batchId);
      return repository.parse({ batchId, rows: workbook.records, parserVersion: workbook.parserVersion, correlationId });
    },
    validate(batchId, correlationId) {
      parseUuid(batchId, 'batchId');
      return repository.validate({ batchId, correlationId });
    },
    async preview(batchId) {
      const { workbook } = await read(batchId);
      return buildSelloutPreview({ records: workbook.records });
    },
    publish(batchId, body, correlationId) {
      parseUuid(batchId, 'batchId');
      return repository.publish({ batchId, ...parsePublishRequest(batchId, body), correlationId });
    },
    periods: () => repository.periods(),
    events: (q) => repository.events({
      from: q.from,
      to: q.to,
      customerId: q.customerId ?? null,
      documentNo: q.documentNo ?? null,
      variantId: q.variantId ?? null,
      familyId: q.familyId ?? null,
      movementType: q.movementType ?? null,
      page: page(q.page),
      pageSize: page(q.pageSize, 50)
    }),
    performance: (q) => {
      return repository.performance({
        month: parseMonth(q.month),
        asOf: q.asOf ?? null,
        scopeType: q.scopeType ?? 'COMPANY',
        scopeId: q.scopeId ?? null
      });
    },
    reconciliation: (q) => {
      return repository.reconciliation({
        month: parseMonth(q.month),
        scopeType: q.scopeType ?? 'COMPANY',
        scopeId: q.scopeId ?? null
      });
    },
    exceptions: (q) => repository.exceptions({
      batchId: q.batchId ?? null,
      month: q.month ?? null,
      code: q.code ?? null,
      page: page(q.page),
      pageSize: page(q.pageSize, 50)
    }),
    resolutionPreview(body) {
      return repository.resolutionPreview(body);
    },
    resolutionCommit(body) {
      const x = previewHash(body);
      return repository.resolutionCommit(x.input, x.hash);
    },
    resolutionReverse(id, body) {
      return repository.resolutionReverse(parseUuid(id, 'resolutionId'), body?.reason);
    }
  });
}
