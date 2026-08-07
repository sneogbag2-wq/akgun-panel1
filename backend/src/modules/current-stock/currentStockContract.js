import { createHash } from 'node:crypto';
import { parseIdempotencyRequest, parseUuid, requestFingerprint } from '../imports/importContracts.js';

export const CURRENT_STOCK_SOURCE_KIND = 'CURRENT_STOCK_AVAILABLE';
export const CURRENT_STOCK_PARSER_VERSION = 'current-stock-v2/1.0.0';
export const CURRENT_STOCK_HEADERS = Object.freeze(['Malzeme numarası', 'Malzeme tanımı', 'Tahditsiz kullanılabilir']);
export class CurrentStockContractError extends Error { constructor(code, messageKey, details = {}) { super(code); this.name = 'CurrentStockContractError'; this.code = code; this.messageKey = messageKey; this.details = details; } }
export const sha256 = (value) => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
export function cleanText(value) { if (typeof value !== 'string') return null; const cleaned = value.normalize('NFC').trim().replace(/\s+/gu, ' '); return cleaned || null; }
export function headerText(value) { return cleanText(value)?.toLocaleLowerCase('tr-TR') ?? null; }
export function headerMatches(headers) { const actual = headers.map(headerText); const wanted = CURRENT_STOCK_HEADERS.map(headerText); return wanted.every((header) => actual.includes(header)); }
export function canonicalQuantity(value) { const raw = cleanText(value); if (!raw || !/^\d+(?:[.,][0-9]+)?$/u.test(raw)) return null; const normalized = raw.replace(',', '.'); return normalized.replace(/^0+(?=\d)/u, '').replace(/(\.[0-9]*?)0+$/u, '$1').replace(/\.$/u, '') || '0'; }
export function parsePagination(value, fallback = 1, maximum = 100) { if (value === undefined || value === '') return fallback; if (typeof value !== 'string' || !/^[1-9][0-9]*$/u.test(value) || Number(value) > maximum) throw new CurrentStockContractError('INVALID_PAGINATION', 'currentStock.request.invalidPagination'); return Number(value); }
export function parsePublishRequest(batchId, body) { const input = parseIdempotencyRequest(body, ['expectedValidationRunId']); const expectedValidationRunId = parseUuid(input.expectedValidationRunId, 'expectedValidationRunId'); const expectedActiveImportId = input.expectedActiveImportId === null || input.expectedActiveImportId === undefined || input.expectedActiveImportId === '' ? null : parseUuid(input.expectedActiveImportId, 'expectedActiveImportId'); return Object.freeze({ expectedValidationRunId, expectedActiveImportId, idempotencyKey: input.idempotencyKey, requestFingerprint: requestFingerprint({ batchId, expectedValidationRunId, expectedActiveImportId }), }); }
