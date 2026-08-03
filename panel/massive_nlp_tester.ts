import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';

import { parseSales } from './src/parsers/salesParser';
import { parseCollection } from './src/parsers/collectionParser';
import { parseChequeSenet } from './src/parsers/chequeSenetParser';
import { parseSellout } from './src/parsers/selloutParser';
import { parseCustomerMaster } from './src/parsers/customerMasterParser';
import { setMockDataForTest } from './src/services/customerService';
import { getRelevantToolsForQuery, executeAiTool } from './src/services/aiTools';

const VERI_DIR = 'C:\\Users\\monds\\Desktop\\test\\VERİ';

function readExcel(filename: string) {
  const filePath = path.join(VERI_DIR, filename);
  if (!fs.existsSync(filePath)) {
    console.log(`[WARN] File not found: ${filePath}`);
    return [];
  }
  const buffer = fs.readFileSync(filePath);
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json(worksheet, { defval: '' });
}

async function runTests() {
  console.log("=== LOADING MASSIVE EXCEL DATA ===");

  const rawSales = readExcel('SATIŞ.xlsx');
  const rawNakit = readExcel('NAKİT.xlsx');
  const rawHavale = readExcel('Havale.xlsx');
  const rawCek = readExcel('CEK.xlsx');
  const rawSenet = readExcel('SENET.xlsx');
  const rawMaster = readExcel('export (6).xlsx');
  const rawSellout = readExcel('Sellout Raporu (2).xlsx');

  console.log("=== RUNNING PARSERS ===");
  
  let customers: any[] = [];
  try { customers = parseCustomerMaster(rawMaster).records; } catch(e) { console.error("Master Parse Error", e); }
  
  let salesInvoices: any[] = [];
  try { salesInvoices = parseSales(rawSales).records; } catch(e) { console.error("Sales Parse Error", e); }
  
  let collections: any[] = [];
  try { collections = parseCollection([...rawNakit, ...rawHavale], 'HAVALE_TAHSILAT').records; } catch(e) { console.error("Collection Parse Error", e); }
  
  let cheques: any[] = [];
  try { cheques = parseChequeSenet([...rawCek, ...rawSenet], 'CEK').records; } catch(e) { console.error("Cheque Parse Error", e); }
  
  let selloutData: any[] = [];
  try { selloutData = parseSellout(rawSellout).records; } catch(e) { console.error("Sellout Parse Error", e); }

  console.log(`Loaded: ${customers.length} Customers, ${salesInvoices.length} Sales, ${collections.length} Collections, ${cheques.length} Cheques, ${selloutData.length} Sellout.`);

  setMockDataForTest({ customers, salesInvoices, collections, cheques, selloutData });

  console.log("=== RUNNING NLP INTENT & TOOL STRESS TEST ===");

  const queries = [
    { q: "Haziran ayı FKNS raporunu ver", args: { month: "2026-06" } },
    { q: "Corona ürününü alan noktalar", args: { materialName: "Corona" } },
    { q: "150021 efes kutu fatura edilen müşteriler", args: { materialName: "150021" } },
    { q: "Açık kanal efes penetrasyonu", args: { materialName: "EFES", channel: "AÇIK" } },
    { q: "Şirketin tahsilat durumu nasıl?", args: {} },
    { q: "Bana en iyi 10 müşterimizi ciroya göre sırala", args: {} },
    { q: "En sorunlu borçlular kimler?", args: {} },
    { q: "Plasiyer performanslarını aylık olarak çıkar", args: {} },
    { q: "Tahsilatları hangi vadelerde alıyoruz yaşlandırma analizi", args: {} },
    { q: "Kredi kartı mı yoksa nakit mi daha çok tahsilat alıyoruz", args: {} },
    { q: "Müşterilerin ödeme trendleri ne yönde?", args: {} },
    { q: "Riskli çekleri listele", args: {} },
    { q: "Boğaziçi market dünkü işlemler", args: { customerName: "Boğaziçi", date: "2026-07-28" } },
    { q: "ALİ YÜKSEL 15 temmuz tahsilatları", args: { salesRep: "ALİ YÜKSEL", date: "2026-07-15" } }
  ];

  let errors = 0;
  
  for (const item of queries) {
    console.log(`\nTesting Query: "${item.q}"`);
    const tools = getRelevantToolsForQuery(item.q);
    
    for (const tool of tools) {
      if (typeof tool === 'object' && tool.name) {
        if (tool.name === 'executeDynamicAnalyticsQuery') continue;
        try {
          const result = await executeAiTool(tool.name, item.args);
          const resultStr = JSON.stringify(result) || '';
          if (resultStr.includes("Hata") || resultStr.includes("Error") || resultStr.includes("Geçersiz")) {
            console.log(`[TOOL ERROR] ${tool.name}: ${resultStr.slice(0, 100)}...`);
            errors++;
          }
        } catch (e) {
          console.log(`[TOOL CRASH] ${tool.name}: ${e.message}`);
          errors++;
        }
      }
    }
  }

  console.log(`\nTesting executeDynamicAnalyticsQuery with massive data...`);
  try {
    const jsCode = `
      let total = 0;
      for(let c of mockCustomers) {
        if(c.balance > 0) total += c.balance;
      }
      return total;
    `;
    await executeAiTool('executeDynamicAnalyticsQuery', { jsFunctionBody: jsCode });
    console.log("executeDynamicAnalyticsQuery: SUCCESS");
  } catch(e) {
    console.log(`executeDynamicAnalyticsQuery CRASH: ${e.message}`);
    errors++;
  }

  console.log(`\nStress Test Completed with ${errors} errors.`);
}

runTests();
