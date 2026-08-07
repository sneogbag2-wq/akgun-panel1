import { createHash, randomUUID } from 'node:crypto';

export const anonymousBatchId = '11111111-1111-4111-8111-111111111111';
export const anonymousValidationRunId = '22222222-2222-4222-8222-222222222222';

export const anonymousSourceCells = Object.freeze({
  A1: Object.freeze({ address: 'A1', columnIndex: 1, rawValue: '0000123', displayValue: '0000123', sourceType: 'string' }),
  B1: Object.freeze({ address: 'B1', columnIndex: 2, rawValue: '-1.25', displayValue: '-1,25', sourceType: 'string' }),
  C1: Object.freeze({ address: 'C1', columnIndex: 3, rawValue: '01.02.2025', displayValue: '01.02.2025', sourceType: 'string' }),
});

export function createAnonymousImportFixture() {
  const bytes = Buffer.from('package01-anonymous-source-v1', 'utf8');
  return Object.freeze({
    batchId: anonymousBatchId,
    validationRunId: anonymousValidationRunId,
    bytes,
    initiateBody: Object.freeze({
      sourceKind: 'SYNTHETIC_TEST',
      originalFileName: 'anonymous-import.xlsx',
      byteSize: bytes.byteLength,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      declaredSha256: createHash('sha256').update(bytes).digest('hex'),
      scope: Object.freeze({ dealerRef: 'ANON_DEALER_0001', period: '2025-01' }),
      idempotencyKey: `import-${randomUUID()}`,
    }),
    rawRow: Object.freeze({ sheetName: 'Synthetic', rowNumber: 1, cells: anonymousSourceCells }),
  });
}
