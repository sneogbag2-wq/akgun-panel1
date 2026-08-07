import { inflateRawSync } from 'node:zlib';
import {
  CustomerMasterContractError,
  resolveHeaderMap,
  toCustomerMasterRecord,
} from './customerMasterContract.js';

const MAX_ARCHIVE_BYTES = 10 * 1024 * 1024;
const MAX_UNCOMPRESSED_BYTES = 25 * 1024 * 1024;
const MAX_ZIP_ENTRIES = 200;
const MAX_ROWS = 20_000;

function fail(code, details = {}) {
  throw new CustomerMasterContractError(code, `customerMaster.parser.${code.toLowerCase()}`, details);
}

function xmlDecode(value = '') {
  return value
    .replace(/&#x([0-9a-f]+);/giu, (_m, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#([0-9]+);/gu, (_m, code) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&quot;/gu, '"').replace(/&apos;/gu, "'")
    .replace(/&lt;/gu, '<').replace(/&gt;/gu, '>').replace(/&amp;/gu, '&');
}

function attr(attributes, name) {
  return new RegExp(`(?:^|\\s)${name}="([^"]*)"`, 'u').exec(attributes)?.[1] ?? null;
}

function findEndOfCentralDirectory(buffer) {
  const start = Math.max(0, buffer.length - 65_557);
  for (let index = buffer.length - 22; index >= start; index -= 1) {
    if (buffer.readUInt32LE(index) === 0x06054b50) return index;
  }
  fail('INVALID_XLSX_ARCHIVE');
}

function readZipEntries(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0 || buffer.length > MAX_ARCHIVE_BYTES) {
    fail('XLSX_ARCHIVE_SIZE_REJECTED');
  }
  const endOffset = findEndOfCentralDirectory(buffer);
  const count = buffer.readUInt16LE(endOffset + 10);
  const centralOffset = buffer.readUInt32LE(endOffset + 16);
  if (count > MAX_ZIP_ENTRIES || centralOffset >= buffer.length) fail('XLSX_ARCHIVE_STRUCTURE_REJECTED');
  const entries = new Map();
  let offset = centralOffset;
  let totalUncompressed = 0;
  for (let index = 0; index < count; index += 1) {
    if (offset + 46 > buffer.length || buffer.readUInt32LE(offset) !== 0x02014b50) fail('XLSX_ARCHIVE_STRUCTURE_REJECTED');
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const uncompressedSize = buffer.readUInt32LE(offset + 24);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const nameEnd = offset + 46 + nameLength;
    if (nameEnd > buffer.length || method !== 0 && method !== 8 || uncompressedSize > MAX_UNCOMPRESSED_BYTES) fail('XLSX_ARCHIVE_STRUCTURE_REJECTED');
    const name = buffer.subarray(offset + 46, nameEnd).toString('utf8');
    if (!name || name.includes('..') || name.startsWith('/') || entries.has(name)) fail('XLSX_ARCHIVE_STRUCTURE_REJECTED');
    totalUncompressed += uncompressedSize;
    if (totalUncompressed > MAX_UNCOMPRESSED_BYTES) fail('XLSX_ARCHIVE_EXPANSION_REJECTED');
    if (localOffset + 30 > buffer.length || buffer.readUInt32LE(localOffset) !== 0x04034b50) fail('XLSX_ARCHIVE_STRUCTURE_REJECTED');
    const localNameLength = buffer.readUInt16LE(localOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const dataEnd = dataStart + compressedSize;
    if (dataEnd > buffer.length) fail('XLSX_ARCHIVE_STRUCTURE_REJECTED');
    const compressed = buffer.subarray(dataStart, dataEnd);
    const data = method === 0 ? compressed : inflateRawSync(compressed, { maxOutputLength: MAX_UNCOMPRESSED_BYTES });
    if (data.length !== uncompressedSize) fail('XLSX_ARCHIVE_STRUCTURE_REJECTED');
    entries.set(name, data.toString('utf8'));
    offset = nameEnd + extraLength + commentLength;
  }
  return entries;
}

function parseSharedStrings(xml = '') {
  const strings = [];
  for (const match of xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/gu)) {
    const text = [...match[1].matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/gu)].map((part) => xmlDecode(part[1])).join('');
    strings.push(text);
  }
  return strings;
}

function relationshipTargets(xml = '') {
  const targets = new Map();
  for (const match of xml.matchAll(/<Relationship\b([^>]*)\/?>(?:<\/Relationship>)?/gu)) {
    const id = attr(match[1], 'Id');
    const target = attr(match[1], 'Target');
    if (id && target) targets.set(id, target.replace(/^\//u, '').replace(/^xl\//u, ''));
  }
  return targets;
}

function sheetPaths(entries) {
  const workbook = entries.get('xl/workbook.xml');
  const rels = relationshipTargets(entries.get('xl/_rels/workbook.xml.rels'));
  if (!workbook) fail('XLSX_WORKBOOK_NOT_FOUND');
  const sheets = [];
  for (const match of workbook.matchAll(/<sheet\b([^>]*)\/?>(?:<\/sheet>)?/gu)) {
    const name = xmlDecode(attr(match[1], 'name') ?? '');
    const relationId = attr(match[1], 'r:id');
    const target = relationId ? rels.get(relationId) : null;
    if (!name || !target) continue;
    const path = target.startsWith('worksheets/') ? `xl/${target}` : `xl/${target.replace(/^\.\//u, '')}`;
    if (entries.has(path)) sheets.push({ name, path });
  }
  if (!sheets.length) fail('XLSX_WORKSHEET_NOT_FOUND');
  return sheets;
}

function sourceType(cellType) {
  if (cellType === 's' || cellType === 'inlineStr' || cellType === 'str') return 'string';
  if (cellType === 'b') return 'boolean';
  return 'number';
}

function parseSheetRows(xml, sharedStrings) {
  const rows = [];
  for (const rowMatch of xml.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/gu)) {
    const rowNumber = Number(attr(rowMatch[1], 'r'));
    if (!Number.isSafeInteger(rowNumber) || rowNumber < 1) continue;
    const cells = {};
    for (const cellMatch of rowMatch[2].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>|<c\b([^>]*)\/>/gu)) {
      const attributes = cellMatch[1] ?? cellMatch[3] ?? '';
      const body = cellMatch[2] ?? '';
      const address = attr(attributes, 'r');
      if (!address || !/^[A-Z]+[1-9][0-9]*$/u.test(address)) continue;
      const type = attr(attributes, 't');
      const value = /<v>([\s\S]*?)<\/v>/u.exec(body)?.[1] ?? '';
      const inline = /<is\b[^>]*>([\s\S]*?)<\/is>/u.exec(body)?.[1] ?? '';
      let rawValue;
      if (type === 's') rawValue = sharedStrings[Number(value)] ?? '';
      else if (type === 'inlineStr') rawValue = [...inline.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/gu)].map((part) => xmlDecode(part[1])).join('');
      else rawValue = xmlDecode(value);
      cells[address] = Object.freeze({
        address,
        columnIndex: address.replace(/[0-9]+$/u, ''),
        rawValue,
        displayValue: rawValue,
        sourceType: sourceType(type),
      });
    }
    if (Object.keys(cells).length) rows.push(Object.freeze({ rowNumber, cells: Object.freeze(cells) }));
  }
  return rows;
}

export function parseCustomerMasterWorkbook(buffer) {
  const entries = readZipEntries(buffer);
  const sharedStrings = parseSharedStrings(entries.get('xl/sharedStrings.xml'));
  for (const sheet of sheetPaths(entries)) {
    const rows = parseSheetRows(entries.get(sheet.path), sharedStrings);
    for (const headerIndex of rows.keys()) {
      try {
        const headerMap = resolveHeaderMap(rows[headerIndex].cells);
        const records = rows.slice(headerIndex + 1)
          .filter((row) => Object.values(row.cells).some((cell) => cell.rawValue !== ''))
          .map((row) => toCustomerMasterRecord({ sheetName: sheet.name, sourceRowNumber: row.rowNumber, rawCells: row.cells, headerMap }));
        if (records.length > MAX_ROWS) fail('CUSTOMER_MASTER_ROW_LIMIT_EXCEEDED');
        return Object.freeze({ parserVersion: 'customer-master-v2/2.0.0', records: Object.freeze(records) });
      } catch (error) {
        if (error?.code !== 'CUSTOMER_MASTER_HEADER_SIGNATURE_MISMATCH') throw error;
      }
    }
  }
  fail('CUSTOMER_MASTER_HEADER_SIGNATURE_MISMATCH');
}
