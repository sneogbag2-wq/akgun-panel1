import { inflateRawSync } from 'node:zlib';
import { PACKAGE_CONVERSION_PARSER_VERSION, ProductContractError, resolvePackageConversionHeaderMap, toPackageConversionRecord } from './productContract.js';

const MAX_ARCHIVE_BYTES = 10 * 1024 * 1024;
const MAX_UNCOMPRESSED_BYTES = 25 * 1024 * 1024;
const MAX_ZIP_ENTRIES = 200;
const MAX_ROWS = 20_000;
const fail = (code, details = {}) => { throw new ProductContractError(code, `products.parser.${code.toLowerCase()}`, details); };
const xmlDecode = (value = '') => value.replace(/&#x([0-9a-f]+);/giu, (_m, c) => String.fromCodePoint(Number.parseInt(c, 16))).replace(/&#([0-9]+);/gu, (_m, c) => String.fromCodePoint(Number.parseInt(c, 10))).replace(/&quot;/gu, '"').replace(/&apos;/gu, "'").replace(/&lt;/gu, '<').replace(/&gt;/gu, '>').replace(/&amp;/gu, '&');
const attr = (attributes, name) => new RegExp(`(?:^|\\s)${name}="([^"]*)"`, 'u').exec(attributes)?.[1] ?? null;

function zipEntries(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0 || buffer.length > MAX_ARCHIVE_BYTES) fail('XLSX_ARCHIVE_SIZE_REJECTED');
  let end = -1; for (let index = buffer.length - 22; index >= Math.max(0, buffer.length - 65_557); index -= 1) if (buffer.readUInt32LE(index) === 0x06054b50) { end = index; break; }
  if (end < 0) fail('INVALID_XLSX_ARCHIVE');
  const count = buffer.readUInt16LE(end + 10); let offset = buffer.readUInt32LE(end + 16); let total = 0; const entries = new Map();
  if (count > MAX_ZIP_ENTRIES || offset >= buffer.length) fail('XLSX_ARCHIVE_STRUCTURE_REJECTED');
  for (let index = 0; index < count; index += 1) {
    if (offset + 46 > buffer.length || buffer.readUInt32LE(offset) !== 0x02014b50) fail('XLSX_ARCHIVE_STRUCTURE_REJECTED');
    const method = buffer.readUInt16LE(offset + 10); const compressedSize = buffer.readUInt32LE(offset + 20); const uncompressedSize = buffer.readUInt32LE(offset + 24); const nameLength = buffer.readUInt16LE(offset + 28); const extraLength = buffer.readUInt16LE(offset + 30); const commentLength = buffer.readUInt16LE(offset + 32); const local = buffer.readUInt32LE(offset + 42); const nameEnd = offset + 46 + nameLength;
    if (nameEnd > buffer.length || ![0, 8].includes(method) || uncompressedSize > MAX_UNCOMPRESSED_BYTES) fail('XLSX_ARCHIVE_STRUCTURE_REJECTED');
    const name = buffer.subarray(offset + 46, nameEnd).toString('utf8'); total += uncompressedSize;
    if (!name || name.includes('..') || name.startsWith('/') || entries.has(name) || total > MAX_UNCOMPRESSED_BYTES || local + 30 > buffer.length || buffer.readUInt32LE(local) !== 0x04034b50) fail('XLSX_ARCHIVE_STRUCTURE_REJECTED');
    const start = local + 30 + buffer.readUInt16LE(local + 26) + buffer.readUInt16LE(local + 28); const finish = start + compressedSize;
    if (finish > buffer.length) fail('XLSX_ARCHIVE_STRUCTURE_REJECTED');
    const data = method === 0 ? buffer.subarray(start, finish) : inflateRawSync(buffer.subarray(start, finish), { maxOutputLength: MAX_UNCOMPRESSED_BYTES });
    if (data.length !== uncompressedSize) fail('XLSX_ARCHIVE_STRUCTURE_REJECTED'); entries.set(name, data.toString('utf8')); offset = nameEnd + extraLength + commentLength;
  }
  return entries;
}
function sharedStrings(xml = '') { return [...xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/gu)].map((part) => [...part[1].matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/gu)].map((text) => xmlDecode(text[1])).join('')); }
function sheets(entries) {
  const workbook = entries.get('xl/workbook.xml'); const relXml = entries.get('xl/_rels/workbook.xml.rels'); if (!workbook || !relXml) fail('XLSX_WORKBOOK_NOT_FOUND');
  const rels = new Map([...relXml.matchAll(/<Relationship\b([^>]*)\/?>(?:<\/Relationship>)?/gu)].map((match) => [attr(match[1], 'Id'), attr(match[1], 'Target')]));
  const result = []; for (const match of workbook.matchAll(/<sheet\b([^>]*)\/?>(?:<\/sheet>)?/gu)) { const name = xmlDecode(attr(match[1], 'name') ?? ''); const target = rels.get(attr(match[1], 'r:id')); const path = target ? `xl/${target.replace(/^\.\//u, '')}` : null; if (name && path && entries.has(path)) result.push({ name, path }); }
  if (!result.length) fail('XLSX_WORKSHEET_NOT_FOUND'); return result;
}
function rows(xml, strings) {
  const result = []; for (const match of xml.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/gu)) { const rowNumber = Number(attr(match[1], 'r')); if (!Number.isSafeInteger(rowNumber) || rowNumber < 1) continue; const cells = {};
    for (const c of match[2].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>|<c\b([^>]*)\/>/gu)) { const attributes = c[1] ?? c[3] ?? ''; const address = attr(attributes, 'r'); if (!address || !/^[A-Z]+[1-9][0-9]*$/u.test(address)) continue; const type = attr(attributes, 't'); const body = c[2] ?? ''; const value = /<v>([\s\S]*?)<\/v>/u.exec(body)?.[1] ?? ''; const inline = /<is\b[^>]*>([\s\S]*?)<\/is>/u.exec(body)?.[1] ?? ''; const rawValue = type === 's' ? strings[Number(value)] ?? '' : type === 'inlineStr' ? [...inline.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/gu)].map((item) => xmlDecode(item[1])).join('') : xmlDecode(value); cells[address] = Object.freeze({ address, columnIndex: address.replace(/[0-9]+$/u, ''), rawValue, displayValue: rawValue, sourceType: ['s', 'inlineStr', 'str'].includes(type) ? 'string' : type === 'b' ? 'boolean' : 'number' }); }
    if (Object.keys(cells).length) result.push(Object.freeze({ rowNumber, cells: Object.freeze(cells) }));
  } return result;
}
export function parsePackageConversionWorkbook(buffer) {
  const entries = zipEntries(buffer); const strings = sharedStrings(entries.get('xl/sharedStrings.xml'));
  for (const sheet of sheets(entries)) { const parsedRows = rows(entries.get(sheet.path), strings); for (const index of parsedRows.keys()) try { const headerMap = resolvePackageConversionHeaderMap(parsedRows[index].cells); const records = parsedRows.slice(index + 1).filter((row) => Object.values(row.cells).some((cell) => cell.rawValue !== '')).map((row) => toPackageConversionRecord({ sheetName: sheet.name, sourceRowNumber: row.rowNumber, rawCells: row.cells, headerMap })); if (records.length > MAX_ROWS) fail('PACKAGE_CONVERSION_ROW_LIMIT_EXCEEDED'); return Object.freeze({ parserVersion: PACKAGE_CONVERSION_PARSER_VERSION, records: Object.freeze(records) }); } catch (error) { if (error?.code !== 'PACKAGE_CONVERSION_HEADER_SIGNATURE_MISMATCH') throw error; }
  } fail('PACKAGE_CONVERSION_HEADER_SIGNATURE_MISMATCH');
}
