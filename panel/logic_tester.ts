import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';

import { parseSales } from './src/parsers/salesParser';
import { parseCollection } from './src/parsers/collectionParser';
import { parseChequeSenet } from './src/parsers/chequeSenetParser';
import { parseSellout } from './src/parsers/selloutParser';
import { parseCustomerMaster } from './src/parsers/customerMasterParser';
import { setMockDataForTest } from './src/services/customerService';
import { 
  getGlobalFinancialSummarySync,
  getMonthlyRiskAndRevenueReportSync,
  getFinancialHealthReportSync,
  getParetoConcentrationAnalysisSync,
  calculateDeepInvoiceAnalysisSync,
  getMonthlySalesRepPerformanceSync
} from './src/services/customerService';
import { calculateFknsForRep } from './src/calculations/fknsCalculations';

const VERI_DIR = 'C:\\Users\\monds\\Desktop\\test\\VERİ';

function readExcel(filename: string) {
  const filePath = path.join(VERI_DIR, filename);
  if (!fs.existsSync(filePath)) return [];
  const buffer = fs.readFileSync(filePath);
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  return XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: '' });
}

async function runLogicTests() {
  const rawSales = readExcel('SATIŞ.xlsx');
  const rawNakit = readExcel('NAKİT.xlsx');
  const rawHavale = readExcel('Havale.xlsx');
  const rawCek = readExcel('CEK.xlsx');
  const rawSenet = readExcel('SENET.xlsx');
  const rawMaster = readExcel('export (6).xlsx');
  const rawSellout = readExcel('Sellout Raporu (2).xlsx');

  const customers = parseCustomerMaster(rawMaster).records;
  const salesInvoices = parseSales(rawSales).records;
  const collections = parseCollection([...rawNakit, ...rawHavale], 'HAVALE_TAHSILAT').records;
  const cheques = parseChequeSenet([...rawCek, ...rawSenet], 'CEK').records;
  const selloutData = parseSellout(rawSellout).records;

  setMockDataForTest({ customers, salesInvoices, collections, cheques, selloutData });

  const reports = {
    globalSummary: getGlobalFinancialSummarySync(),
    monthlyRisk: getMonthlyRiskAndRevenueReportSync(),
    pareto: getParetoConcentrationAnalysisSync(),
    salesRepPerformance: getMonthlySalesRepPerformanceSync(),
    fkns: calculateFknsForRep('TÜMÜ', 'TÜMÜ')
  };

  fs.writeFileSync('C:\\Users\\monds\\.gemini\\antigravity\\brain\\44ca5dfc-e815-4b01-bf18-a1b6358b9e42\\scratch\\logic_dump.json', JSON.stringify(reports, null, 2));
  console.log("Logic dump created successfully.");
}

runLogicTests();
