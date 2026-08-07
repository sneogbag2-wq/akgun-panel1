import { createHash } from 'node:crypto';

export const PACKAGE_CONVERSION_SOURCE_KIND = 'PACKAGE_CONVERSION_HISTORY';
export const PACKAGE_CONVERSION_PARSER_VERSION = 'package-conversion-v2/1.0.0';

export class ProductContractError extends Error {
  constructor(code, messageKey, details = {}) {
    super(code); this.name = 'ProductContractError'; this.code = code; this.messageKey = messageKey; this.details = details;
  }
}

export function cleanSourceText(value) {
  if (typeof value !== 'string') return null;
  const result = value.normalize('NFKC').trim().replace(/\s+/gu, ' ');
  return result || null;
}

export function normalizeComparisonText(value) {
  const cleaned = cleanSourceText(value);
  return cleaned ? cleaned.toLocaleLowerCase('tr-TR') : null;
}

export function sha256(value) {
  const canonical = typeof value === 'string' ? value : JSON.stringify(value, Object.keys(value ?? {}).sort());
  return createHash('sha256').update(canonical).digest('hex');
}

export function parseAsOf(value) {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) throw new ProductContractError('INVALID_AS_OF', 'products.request.invalidAsOf');
  return new Date(value).toISOString();
}

export function parsePositiveInt(value, fallback, maximum = 100) {
  if (value === undefined || value === '') return fallback;
  if (typeof value !== 'string' || !/^[1-9][0-9]*$/u.test(value)) throw new ProductContractError('INVALID_PAGINATION', 'products.request.invalidPagination');
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed > maximum) throw new ProductContractError('INVALID_PAGINATION', 'products.request.invalidPagination');
  return parsed;
}

export function parseUuid(value, field) {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value.trim())) {
    throw new ProductContractError('INVALID_UUID', 'products.request.invalidUuid', { field });
  }
  return value.trim();
}

export function canonicalDecimalText(value, field) {
  if (typeof value !== 'string' || !/^(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/u.test(value.trim())) {
    throw new ProductContractError('INVALID_DECIMAL', 'products.request.invalidDecimal', { field });
  }
  const [integer, fraction = ''] = value.trim().split('.');
  const normalized = `${integer.replace(/^0+(?=\d)/u, '')}${fraction ? `.${fraction.replace(/0+$/u, '') || '0'}` : ''}`;
  if (normalized === '0' || normalized === '0.0') throw new ProductContractError('INVALID_CONVERSION_QUANTITY', 'products.request.nonPositiveQuantity', { field });
  return normalized;
}

function excelSerialDate(raw) {
  if (!/^\d+(?:\.0+)?$/u.test(raw)) return null;
  const serial = Number(raw);
  if (!Number.isSafeInteger(serial) || serial < 1 || serial > 100_000) return null;
  return new Date(Date.UTC(1899, 11, 30) + serial * 86_400_000).toISOString().slice(0, 10);
}

export function parseOperationDate(cell) {
  const raw = cleanSourceText(cell?.rawValue);
  if (!raw) return null;
  if (cell?.sourceType === 'number') return excelSerialDate(raw);
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(raw) || Number.isNaN(Date.parse(`${raw}T00:00:00.000Z`))) return null;
  return raw;
}

function columnIndex(address) {
  return [...address.replace(/[0-9]+$/u, '')].reduce((value, char) => value * 26 + char.charCodeAt(0) - 64, 0);
}

export function resolvePackageConversionHeaderMap(headerCells) {
  const cells = Object.values(headerCells).map((cell) => ({ ...cell, normalized: normalizeComparisonText(cell.rawValue), index: columnIndex(cell.address) }));
  const operation = cells.find((cell) => cell.normalized === normalizeComparisonText('İşlem Tarihi'));
  const source = cells.find((cell) => cell.normalized === normalizeComparisonText('Bozulan/Birleştirilen Ürün Kodu'));
  const target = cells.find((cell) => cell.normalized === normalizeComparisonText('Oluşan Ürün Kodu'));
  const sourceQuantity = source && cells.find((cell) => cell.index === source.index + 1 && cell.normalized === normalizeComparisonText('Miktar'));
  const targetQuantity = target && cells.find((cell) => cell.index === target.index + 1 && cell.normalized === normalizeComparisonText('Miktar'));
  if (!operation || !source || !sourceQuantity || !target || !targetQuantity) {
    throw new ProductContractError('PACKAGE_CONVERSION_HEADER_SIGNATURE_MISMATCH', 'products.header.signatureMismatch');
  }
  const document = cells.find((cell) => cell.index === source.index + 3 && cell.normalized === normalizeComparisonText('Malzeme Belgesi'));
  return Object.freeze({
    operationDate: operation.address.replace(/[0-9]+$/u, ''), sourceMaterialCode: source.address.replace(/[0-9]+$/u, ''),
    sourceQuantity: sourceQuantity.address.replace(/[0-9]+$/u, ''), targetMaterialCode: target.address.replace(/[0-9]+$/u, ''),
    targetQuantity: targetQuantity.address.replace(/[0-9]+$/u, ''), sourceDocumentReference: document?.address.replace(/[0-9]+$/u, '') ?? null,
  });
}

function rawMaterialCode(cell) {
  const value = cleanSourceText(cell?.rawValue);
  if (!value || /[eE][+-]?\d+/u.test(value)) return null;
  return value;
}

export function toPackageConversionRecord({ sheetName, sourceRowNumber, rawCells, headerMap }) {
  const cell = (field) => headerMap[field] ? rawCells[`${headerMap[field]}${sourceRowNumber}`] : null;
  const parsedPayload = {
    operationDate: parseOperationDate(cell('operationDate')),
    sourceMaterialCode: rawMaterialCode(cell('sourceMaterialCode')),
    targetMaterialCode: rawMaterialCode(cell('targetMaterialCode')),
    sourceQuantity: null,
    targetQuantity: null,
    sourceDocumentReference: cleanSourceText(cell('sourceDocumentReference')?.rawValue),
  };
  const warnings = [];
  for (const [field, issue] of [['sourceMaterialCode', 'INVALID_MATERIAL_CODE'], ['targetMaterialCode', 'INVALID_MATERIAL_CODE']]) if (!parsedPayload[field]) warnings.push(issue);
  if (!parsedPayload.operationDate) warnings.push('INVALID_CONVERSION_DATE');
  for (const field of ['sourceQuantity', 'targetQuantity']) {
    const value = cleanSourceText(cell(field)?.rawValue);
    try { parsedPayload[field] = canonicalDecimalText(value, field); } catch { warnings.push('INVALID_CONVERSION_QUANTITY'); }
  }
  if (parsedPayload.sourceMaterialCode && parsedPayload.sourceMaterialCode === parsedPayload.targetMaterialCode) warnings.push('SELF_CONVERSION_EDGE');
  const naturalKey = {
    sourceKind: PACKAGE_CONVERSION_SOURCE_KIND, operationDate: parsedPayload.operationDate,
    sourceMaterialCode: parsedPayload.sourceMaterialCode, targetMaterialCode: parsedPayload.targetMaterialCode,
    sourceDocumentReference: parsedPayload.sourceDocumentReference,
  };
  return Object.freeze({ sheetName, sourceRowNumber, rawCells, parsedPayload: Object.freeze(parsedPayload), parserWarnings: Object.freeze([...new Set(warnings)]),
    rowHash: sha256({ sheetName, sourceRowNumber, rawCells }), naturalKeyHash: sha256(naturalKey) });
}
