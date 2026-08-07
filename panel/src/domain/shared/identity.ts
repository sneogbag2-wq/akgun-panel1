/**
 * Paket 00 ortak kimlik sözleşmesi.
 *
 * Kimlikler hiçbir zaman sayısal değere çevrilmez. Bu modül yalnızca sonraki
 * domain paketlerinin kullanacağı tipli sınırı kurar; mevcut akışa bağlı değildir.
 */

declare const identityBrand: unique symbol;

type BrandedString<Kind extends string> = string & {
  readonly [identityBrand]: Kind;
};

export type CustomerId = BrandedString<'CustomerId'>;
export type ProductCode = BrandedString<'ProductCode'>;
export type DocumentId = BrandedString<'DocumentId'>;
export type InvoiceNo = BrandedString<'InvoiceNo'>;
export type SalesDocumentNo = BrandedString<'SalesDocumentNo'>;
export type SourceRowId = BrandedString<'SourceRowId'>;

function createIdentity<Kind extends string>(value: string, label: string): BrandedString<Kind> {
  if (typeof value !== 'string') {
    throw new TypeError(`${label} metin olmalıdır.`);
  }

  const normalized = value.trim();
  if (!normalized) {
    throw new TypeError(`${label} boş olamaz.`);
  }

  return normalized as BrandedString<Kind>;
}

export function createCustomerId(value: string): CustomerId {
  return createIdentity<'CustomerId'>(value, 'CustomerId');
}

export function createProductCode(value: string): ProductCode {
  return createIdentity<'ProductCode'>(value, 'ProductCode');
}

export function createDocumentId(value: string): DocumentId {
  return createIdentity<'DocumentId'>(value, 'DocumentId');
}

export function createInvoiceNo(value: string): InvoiceNo {
  return createIdentity<'InvoiceNo'>(value, 'InvoiceNo');
}

export function createSalesDocumentNo(value: string): SalesDocumentNo {
  return createIdentity<'SalesDocumentNo'>(value, 'SalesDocumentNo');
}

export function createSourceRowId(value: string): SourceRowId {
  return createIdentity<'SourceRowId'>(value, 'SourceRowId');
}
