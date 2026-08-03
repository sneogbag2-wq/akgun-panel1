import { performance } from 'perf_hooks';
import { 
  getGlobalFinancialSummarySync,
  getMonthlySalesRepPerformanceSync,
  searchCustomersSync,
  getCustomerStatementSync,
  calculateDeepInvoiceAnalysisSync,
  getAgingBuckets,
  executeDynamicAnalyticsQuerySync
} from './src/services/customerService';
import { calculateFknsForRep, calculateProductPenetration } from './src/calculations/fknsCalculations';
import { aiToolDeclarations } from './src/services/aiTools';

async function runBenchmarks() {
  console.log("Starting tool performance benchmarks...");

  function measure(name, fn) {
    const start = performance.now();
    try {
      fn();
    } catch (e) {
      console.log(`[Error in ${name}]: ${e.message}`);
    }
    const end = performance.now();
    console.log(`${name}: ${(end - start).toFixed(2)} ms`);
  }

  // Measure heavy functions
  measure('getGlobalFinancialSummarySync', () => getGlobalFinancialSummarySync());
  measure('getMonthlySalesRepPerformanceSync', () => getMonthlySalesRepPerformanceSync());
  measure('searchCustomersSync (empty query)', () => searchCustomersSync(''));
  measure('searchCustomersSync (specific query)', () => searchCustomersSync('Boğaziçi'));
  measure('getCustomerStatementSync', () => getCustomerStatementSync('5000266833'));
  measure('calculateDeepInvoiceAnalysisSync', () => calculateDeepInvoiceAnalysisSync('5000266833', '2026-07-28'));
  measure('calculateFknsForRep', () => calculateFknsForRep('DOĞUŞ ARK', 'TÜMÜ'));
  measure('calculateProductPenetration', () => calculateProductPenetration('DOĞUŞ ARK', 'Corona', 'TÜMÜ'));

  const jsFunctionBody = `
    let total = 0;
    for(let c of mockCustomers) {
      if(c.balance > 0) total += c.balance;
    }
    return total;
  `;
  measure('executeDynamicAnalyticsQuerySync (simple)', () => executeDynamicAnalyticsQuerySync({ jsFunctionBody }));

  // Check how many tools are in coreToolNames and calculate their token payload roughly
  const coreTools = [
    'getGlobalFinancialSummary', 'getCurrentStatus', 'searchCustomers', 'getCustomerDetails', 
    'getCustomerStatement', 'queryTransactions', 'getTopDebtors', 'getTopCustomersBySalesVolume', 
    'getFinancialHealthReport', 'getMonthlyRiskAndRevenueReport', 'getInvoiceControlReport', 
    'getShipmentTrackingReport', 'executeDynamicAnalyticsQuery', 'defineSubagent', 'invokeSubagent',
    'getSalesFkns', 'getProductPenetration'
  ];

  let coreSchemaBytes = 0;
  for (const t of aiToolDeclarations) {
    if (coreTools.includes(t.name)) {
      coreSchemaBytes += JSON.stringify(t).length;
    }
  }

  let allSchemaBytes = 0;
  for (const t of aiToolDeclarations) {
    allSchemaBytes += JSON.stringify(t).length;
  }

  console.log(`\nTool Payload Size Analysis:`);
  console.log(`Core Tools (17): ~${coreSchemaBytes} bytes`);
  console.log(`All Tools (${aiToolDeclarations.length}): ~${allSchemaBytes} bytes`);

}

runBenchmarks();
