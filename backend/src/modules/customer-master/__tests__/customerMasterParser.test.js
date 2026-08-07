import test from 'node:test';
import assert from 'node:assert/strict';
import { deflateRawSync } from 'node:zlib';
import { parseCustomerMasterWorkbook } from '../customerMasterParser.js';

function zip(entries) {
  const locals = [];
  const central = [];
  let offset = 0;
  for (const [name, content] of Object.entries(entries)) {
    const data = Buffer.from(content);
    const compressed = deflateRawSync(data);
    const nameBytes = Buffer.from(name);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(8, 8);
    local.writeUInt32LE(compressed.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(nameBytes.length, 26);
    locals.push(local, nameBytes, compressed);
    const directory = Buffer.alloc(46);
    directory.writeUInt32LE(0x02014b50, 0); directory.writeUInt16LE(20, 4); directory.writeUInt16LE(20, 6); directory.writeUInt16LE(8, 10);
    directory.writeUInt32LE(compressed.length, 20); directory.writeUInt32LE(data.length, 24); directory.writeUInt16LE(nameBytes.length, 28); directory.writeUInt32LE(offset, 42);
    central.push(directory, nameBytes);
    offset += local.length + nameBytes.length + compressed.length;
  }
  const centralLength = central.reduce((sum, value) => sum + value.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(Object.keys(entries).length, 8); end.writeUInt16LE(Object.keys(entries).length, 10); end.writeUInt32LE(centralLength, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, ...central, end]);
}

function inline(address, value, type = 'inlineStr') {
  return type === 'n' ? `<c r="${address}"><v>${value}</v></c>` : `<c r="${address}" t="inlineStr"><is><t>${value}</t></is></c>`;
}

test('restricted XLSX reader accepts required signature, retains raw strings and rejects numeric customer identity', () => {
  const headers = ['Müşteri', 'Müşteri Adı', 'Tabela Adı', 'Satış Temsilcisi Adı', 'Dist Satış Şefi Adı', 'Satış Kanalı Tanımı', 'Müşteri Hacim Segmenti', 'Müşteri Durumu'];
  const sheet = `<worksheet><sheetData><row r="1">${headers.map((header, index) => inline(`${String.fromCharCode(65 + index)}1`, header)).join('')}</row><row r="2">${inline('A2', '5000000001')}${inline('B2', 'Anonim Market')}${inline('C2', 'Anonim')}${inline('D2', 'Rep')}${inline('E2', 'SSM')}${inline('F2', 'Standart Açık')}${inline('G2', 'Diamond')}${inline('H2', 'Aktif')}</row><row r="3">${inline('A3', '5000000002', 'n')}${inline('B3', 'Numara Hücresi')}${inline('C3', 'Anonim')}${inline('D3', 'Rep')}${inline('E3', 'SSM')}${inline('F3', 'Standart Açık')}${inline('G3', 'Diamond')}${inline('H3', 'Aktif')}</row></sheetData></worksheet>`;
  const workbook = zip({
    'xl/workbook.xml': '<workbook><sheets><sheet name="Master" sheetId="1" r:id="rId1"/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels': '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>',
    'xl/worksheets/sheet1.xml': sheet,
  });
  const parsed = parseCustomerMasterWorkbook(workbook);
  assert.equal(parsed.records.length, 2);
  assert.equal(parsed.records[0].customerCodeCandidate, '5000000001');
  assert.equal(parsed.records[0].customerCodeValid, true);
  assert.equal(parsed.records[1].customerCodeValid, false);
  assert.deepEqual(parsed.records[1].parserWarnings, ['CUSTOMER_CODE_COERCION_ATTEMPT']);
});
