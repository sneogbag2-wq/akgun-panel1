/**
 * Paket 00 sentetik fixture factory.
 *
 * Bu değerler gerçek Excel, müşteri, ürün veya finansal işlemden alınmaz.
 * Testler yalnız kimlik ve para biçimi gibi yapısal özellikleri kullanmalıdır.
 */

export interface AnonymousDomainFixture {
  readonly customerId: string;
  readonly productCode: string;
  readonly documentIdWithLeadingZero: string;
  readonly longDocumentId: string;
  readonly sourceFileId: string;
  readonly importBatchId: string;
  readonly sheetName: string;
  readonly sourceRowNumber: number;
  readonly negativeCollectionAmount: string;
  readonly twoDecimalAmount: string;
}

export function createAnonymousDomainFixture(): AnonymousDomainFixture {
  return {
    customerId: '5000000001',
    productCode: 'ANON-PRD-0001',
    documentIdWithLeadingZero: '0000123',
    longDocumentId: '100000000000001',
    sourceFileId: 'anon-source-file-001',
    importBatchId: 'anon-import-batch-001',
    sheetName: 'ANONIM_SAYFA',
    sourceRowNumber: 7,
    negativeCollectionAmount: '-19.50',
    twoDecimalAmount: '120.25'
  };
}
