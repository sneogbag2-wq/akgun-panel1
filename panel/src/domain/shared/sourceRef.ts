/** Paket 00 ham kaynak izi sözleşmesi. */

export interface SourceRef {
  readonly sourceFileId: string;
  readonly importBatchId: string;
  readonly sheetName: string;
  readonly sourceRowNumber: number;
  readonly sourceRecordKey?: string;
}

export type SourceRefInput = SourceRef;

function requireText(value: string, fieldName: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError(`SourceRef.${fieldName} boş olmayan metin olmalıdır.`);
  }

  return value.trim();
}

export function createSourceRef(input: SourceRefInput): SourceRef {
  if (!Number.isInteger(input.sourceRowNumber) || input.sourceRowNumber < 1) {
    throw new RangeError('SourceRef.sourceRowNumber 1 tabanlı pozitif tamsayı olmalıdır.');
  }

  const sourceRecordKey = input.sourceRecordKey === undefined
    ? undefined
    : requireText(input.sourceRecordKey, 'sourceRecordKey');

  return {
    sourceFileId: requireText(input.sourceFileId, 'sourceFileId'),
    importBatchId: requireText(input.importBatchId, 'importBatchId'),
    sheetName: requireText(input.sheetName, 'sheetName'),
    sourceRowNumber: input.sourceRowNumber,
    ...(sourceRecordKey === undefined ? {} : { sourceRecordKey })
  };
}
