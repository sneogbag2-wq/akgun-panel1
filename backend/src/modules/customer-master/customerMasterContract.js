import { createHash } from 'node:crypto';

export const CUSTOMER_MASTER_SOURCE_KIND = 'CUSTOMER_MASTER';
export const CUSTOMER_MASTER_PARSER_VERSION = 'customer-master-v2/2.0.0';

export const REQUIRED_HEADERS = Object.freeze({
  customerCode: 'Müşteri',
  customerName: 'Müşteri Adı',
  storeName: 'Tabela Adı',
  salesRep: 'Satış Temsilcisi Adı',
  distSalesChief: 'Dist Satış Şefi Adı',
  channel: 'Satış Kanalı Tanımı',
  segment: 'Müşteri Hacim Segmenti',
  customerStatus: 'Müşteri Durumu',
});

export class CustomerMasterContractError extends Error {
  constructor(code, messageKey, details = {}) {
    super(code);
    this.name = 'CustomerMasterContractError';
    this.code = code;
    this.messageKey = messageKey;
    this.details = details;
  }
}

export function normalizeComparisonText(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.normalize('NFKC').trim().replace(/\s+/gu, ' ').toLocaleLowerCase('tr-TR');
  return normalized === '' ? null : normalized;
}

export function cleanSourceText(value) {
  if (typeof value !== 'string') return null;
  const cleaned = value.normalize('NFKC').trim().replace(/\s+/gu, ' ');
  return cleaned === '' ? null : cleaned;
}

export function validateCustomerCode(rawValue, sourceType) {
  if (sourceType !== 'string' || typeof rawValue !== 'string') {
    return Object.freeze({ valid: false, candidate: typeof rawValue === 'string' ? rawValue.trim() : null, issue: 'CUSTOMER_CODE_COERCION_ATTEMPT' });
  }
  const candidate = rawValue.trim();
  if (!/^500[0-9]+$/.test(candidate)) {
    return Object.freeze({ valid: false, candidate: candidate || null, issue: 'INVALID_CUSTOMER_CODE' });
  }
  return Object.freeze({ valid: true, candidate, issue: null });
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function sha256(value) {
  return createHash('sha256').update(typeof value === 'string' ? value : canonicalJson(value)).digest('hex');
}

export function resolveHeaderMap(headerCells) {
  const normalizedToAddress = new Map();
  for (const [address, cell] of Object.entries(headerCells)) {
    const normalized = normalizeComparisonText(cell?.rawValue);
    if (normalized) normalizedToAddress.set(normalized, address);
  }
  const result = {};
  const missing = [];
  for (const [field, label] of Object.entries(REQUIRED_HEADERS)) {
    const address = normalizedToAddress.get(normalizeComparisonText(label));
    if (!address) missing.push(label);
    else result[field] = address.replace(/[0-9]+$/u, '');
  }
  if (missing.length) {
    throw new CustomerMasterContractError('CUSTOMER_MASTER_HEADER_SIGNATURE_MISMATCH', 'customerMaster.header.requiredFieldsMissing', { missing });
  }
  return Object.freeze(result);
}

export function toCustomerMasterRecord({ sheetName, sourceRowNumber, rawCells, headerMap }) {
  const sourceValue = (field) => rawCells[`${headerMap[field]}${sourceRowNumber}`] ?? null;
  const customerCell = sourceValue('customerCode');
  const code = validateCustomerCode(customerCell?.rawValue, customerCell?.sourceType);
  const parsedPayload = Object.freeze({
    customerName: cleanSourceText(sourceValue('customerName')?.rawValue),
    storeName: cleanSourceText(sourceValue('storeName')?.rawValue),
    salesRep: cleanSourceText(sourceValue('salesRep')?.rawValue),
    distSalesChief: cleanSourceText(sourceValue('distSalesChief')?.rawValue),
    channel: cleanSourceText(sourceValue('channel')?.rawValue),
    segment: cleanSourceText(sourceValue('segment')?.rawValue),
    customerStatus: cleanSourceText(sourceValue('customerStatus')?.rawValue),
  });
  const parserWarnings = code.issue ? [code.issue] : [];
  return Object.freeze({
    sheetName,
    sourceRowNumber,
    rawCells,
    rowHash: sha256({ sheetName, sourceRowNumber, rawCells }),
    customerCodeCandidate: code.candidate,
    customerCodeValid: code.valid,
    parsedPayload,
    parserWarnings,
  });
}

export function parseAsOf(value) {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
    throw new CustomerMasterContractError('INVALID_AS_OF', 'customerMaster.request.invalidAsOf');
  }
  return new Date(value).toISOString();
}

export function parsePositiveInt(value, fallback, maximum = 100) {
  if (value === undefined || value === '') return fallback;
  if (typeof value !== 'string' || !/^[1-9][0-9]*$/u.test(value)) {
    throw new CustomerMasterContractError('INVALID_PAGINATION', 'customerMaster.request.invalidPagination');
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed > maximum) {
    throw new CustomerMasterContractError('INVALID_PAGINATION', 'customerMaster.request.invalidPagination');
  }
  return parsed;
}

export function parseOrganizationScope(value) {
  if (value === undefined || value === '') return 'SALES';
  if (typeof value !== 'string') {
    throw new CustomerMasterContractError('INVALID_ORGANIZATION_SCOPE', 'customerMaster.request.invalidOrganizationScope');
  }
  const scope = value.trim().toUpperCase();
  if (!['SALES', 'FINANCIAL', 'ALL'].includes(scope)) {
    throw new CustomerMasterContractError('INVALID_ORGANIZATION_SCOPE', 'customerMaster.request.invalidOrganizationScope');
  }
  return scope;
}

export function parseIssueState(value) {
  if (value === undefined || value === '') return null;
  if (typeof value !== 'string') {
    throw new CustomerMasterContractError('INVALID_ISSUE_STATE', 'customerMaster.request.invalidIssueState');
  }
  const state = value.trim().toUpperCase();
  if (!['OPEN', 'RESOLVED', 'WAIVED'].includes(state)) {
    throw new CustomerMasterContractError('INVALID_ISSUE_STATE', 'customerMaster.request.invalidIssueState');
  }
  return state;
}

export function parseOptionalFilter(value, field) {
  if (value === undefined || value === '') return null;
  if (typeof value !== 'string' || value.trim() === '') {
    throw new CustomerMasterContractError('INVALID_FILTER', 'customerMaster.request.invalidFilter', { field });
  }
  return value.trim();
}
