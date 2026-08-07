import test from 'node:test';
import assert from 'node:assert/strict';
import { deflateRawSync } from 'node:zlib';
import { parsePackageConversionWorkbook } from '../packageConversionParser.js';

function zip(entries) { const local=[]; const central=[]; let offset=0; for (const [name,content] of Object.entries(entries)) { const data=Buffer.from(content); const compressed=deflateRawSync(data); const file=Buffer.from(name); const head=Buffer.alloc(30); head.writeUInt32LE(0x04034b50,0);head.writeUInt16LE(20,4);head.writeUInt16LE(8,8);head.writeUInt32LE(compressed.length,18);head.writeUInt32LE(data.length,22);head.writeUInt16LE(file.length,26);local.push(head,file,compressed);const dir=Buffer.alloc(46);dir.writeUInt32LE(0x02014b50,0);dir.writeUInt16LE(20,4);dir.writeUInt16LE(20,6);dir.writeUInt16LE(8,10);dir.writeUInt32LE(compressed.length,20);dir.writeUInt32LE(data.length,24);dir.writeUInt16LE(file.length,28);dir.writeUInt32LE(offset,42);central.push(dir,file);offset+=head.length+file.length+compressed.length;}const length=central.reduce((sum,item)=>sum+item.length,0);const end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(Object.keys(entries).length,8);end.writeUInt16LE(Object.keys(entries).length,10);end.writeUInt32LE(length,12);end.writeUInt32LE(offset,16);return Buffer.concat([...local,...central,end]); }
const inline=(address,value,type='inlineStr')=>type==='n'?`<c r="${address}"><v>${value}</v></c>`:`<c r="${address}" t="inlineStr"><is><t>${value}</t></is></c>`;

test('package conversion parser locks the positional Miktar roles and retains numeric-looking material code lexemes', () => {
  const headers=['Üretim yeri','İşlem Tarihi','Yıl','Bozulan/Birleştirilen Ürün Kodu','Miktar','Temel ölçü birimi','Malzeme Belgesi','Hareket Türü','İşlem Türü','Oluşan Ürün Kodu','Miktar'];
  const sheet=`<worksheet><sheetData><row r="1">${headers.map((name,index)=>inline(`${String.fromCharCode(65+index)}1`,name)).join('')}</row><row r="2">${inline('B2','45883','n')}${inline('D2','101001','n')}${inline('E2','5','n')}${inline('G2','9000000001','n')}${inline('J2','101006','n')}${inline('K2','20','n')}</row></sheetData></worksheet>`;
  const workbook=zip({'xl/workbook.xml':'<workbook><sheets><sheet name="Paket" sheetId="1" r:id="rId1"/></sheets></workbook>','xl/_rels/workbook.xml.rels':'<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>','xl/worksheets/sheet1.xml':sheet});
  const parsed=parsePackageConversionWorkbook(workbook); const row=parsed.records[0];
  assert.equal(row.parsedPayload.sourceMaterialCode,'101001'); assert.equal(row.parsedPayload.targetMaterialCode,'101006'); assert.equal(row.parsedPayload.sourceQuantity,'5'); assert.equal(row.parsedPayload.targetQuantity,'20'); assert.equal(row.parsedPayload.operationDate,'2025-08-14');
});

test('invalid conversion is retained as a parser warning and cannot become a silent edge', () => {
  const headers=['İşlem Tarihi','Bozulan/Birleştirilen Ürün Kodu','Miktar','Oluşan Ürün Kodu','Miktar'];
  const sheet=`<worksheet><sheetData><row r="1">${headers.map((name,index)=>inline(`${String.fromCharCode(65+index)}1`,name)).join('')}</row><row r="2">${inline('A2','2025-01-02')}${inline('B2','151000')}${inline('C2','0','n')}${inline('D2','151000')}${inline('E2','1','n')}</row></sheetData></worksheet>`;
  const workbook=zip({'xl/workbook.xml':'<workbook><sheets><sheet name="Paket" sheetId="1" r:id="rId1"/></sheets></workbook>','xl/_rels/workbook.xml.rels':'<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>','xl/worksheets/sheet1.xml':sheet});
  const row=parsePackageConversionWorkbook(workbook).records[0]; assert.ok(row.parserWarnings.includes('INVALID_CONVERSION_QUANTITY')); assert.ok(row.parserWarnings.includes('SELF_CONVERSION_EDGE'));
});
