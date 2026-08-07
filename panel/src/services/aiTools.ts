/**
 * AI Tool Definitions & Execution Handlers
 * Maps Gemini function calls to customerService and calculations
 */

import type {
  AiAnalysisResult,
  AddManualInvoiceArgs,
  AddManualCollectionArgs,
  AddVirmanTransferArgs,
  DeleteTransactionArgs,
  BulkDeleteTransactionsArgs,
  AddManualChequeArgs,
  UpdateManualChequeArgs,
  DeleteManualChequeArgs,
  ReconcileChequesWithExcelArgs,
  MapAndImportExcelArgs,
  AdvancedMapAndImportExcelArgs,
  ImportCustomerMasterArgs
} from '../types/ai';
import { getCustomerById, waitForInit } from './customerService';
import { formatCurrency } from '../utils/formatters';
import { isAdminAuthenticated } from './customRulesService';
import { aiToolDeclarations } from './aiToolDeclarations';
import { classifyAiQueryIntent, type AiQueryIntent } from './aiIntentClassifier';
import { getReadToolHandler, type AiToolArgs } from './aiReadToolRegistry';
import { getAgentToolHandler } from './aiAgentRegistry';
import { getExcelImportToolHandler } from './aiExcelImportRegistry';
import { getMutationToolHandler } from './aiMutationToolRegistry';
import {
  handleGetFinancialReport,
  handleGetAgingMigration,
  handleGetInvoiceVintage,
  handleGetCashForecast,
  handleRunFinancialScenario,
  handleGetRestatementImpact,
  handleGetCollectionPriority,
  handleGetInstrumentRealization,
  handleGet13WeekCashForecast,
  handleGetForecastBacktest,
  handleGetDeteriorationSignals,
  handleGetRobustAnomalies,
  handleGetBehaviorSegment,
  handleGetFinancialPosition,
  handleGetFinancialReconciliation,
  handleGetAccountingDso,
  handleGetAgedReceivableCei,
  handleGetPaymentSpeed,
  handleExplainFinancialMetric,
  handleGetCustomerFinancialHealth,
  handleExplainFinancialHealthComponent,
  handleGetInternalLimitRecommendation,
  handleExplainInternalLimitChange,
  handleGetRepresentativeFinancialPerformance,
  handleGetSsmFinancialPerformance,
  handleGetFinancialConcentration,
  handleGetAgingMigrationMatrix,
  handleGetInvoiceVintageAnalysis,
  handleGetPaymentSurvival,
  handleGetAgedBurdenFlow,
  handleGetFinancialBehaviorSegment,
  handleGetPeerBenchmark
} from './aiFinancialReportRegistry';
import { handleGenerateReportArtifact, handleGetAiFocusAnalysis } from './aiReportOrchestratorRegistry';
import { handleCheckWarehouseStock, handleCheckCustomerCommercialStock } from './aiInventoryRegistry';
import { handleGetTodaysDispatchOrders, handleGetDeliveredInvoiceControls, handleExplainInvoiceControlAlert } from './aiDispatchRegistry';
import { handleGetSelloutHistoricalComparison, handleGetSelloutMonthlyReport, handleGetSelloutComparisonContributions, handleCreateSelloutReportPack, handleCalculateSelloutProbability } from './aiSelloutRegistry';
import { handleDraftManualTransaction, handlePreviewManualTransaction, handleCommitManualTransaction, handleListManualSourceConflicts } from './aiMutationRegistry';

export { aiToolDeclarations };
export type { AiQueryIntent } from './aiIntentClassifier';
export {
  listDynamicSubagents,
  upsertDynamicSubagent,
  deleteDynamicSubagent
} from './aiAgentRegistry';

export const DISCOVER_MORE_TOOLS = 'discoverMoreTools';

// B14 düzeltmesi: Yazma/silme yapan araçların tek listesi. Daha önce bu liste
// yalnızca executeAiTool() içinde yerel bir sabit olarak tanımlıydı; artık
// dışa aktarılıyor ki aiService.ts aynı listeyi kullanarak okuma çağrılarını
// (paralel) yazma çağrılarından (onay + sıralı) ayırabilsin.
export const MUTATING_TOOLS = [
  'addManualInvoice',
  'addManualCollection',
  'addVirmanTransfer',
  'deleteTransaction',
  'bulkDeleteTransactions',
  'addManualCheque',
  'updateManualCheque',
  'deleteManualCheque',
  'reconcileChequesWithExcel',
  'mapAndImportExcel',
  'advancedMapAndImportExcel',
  'importCustomerMaster',
  'processCustomerMasterImport',
  'purgeTestImportRecords',
  'resetAndClearArchive',
  'clearAllDataArchive',
  'draftManualTransaction',
  'previewManualTransaction',
  'commitManualTransaction',
  'listManualSourceConflicts'
];

export function describeMutatingToolCall(toolName: string, args: any = {}): string {
  const resolveCustomerLabel = (customerId: string | undefined): string => {
    if (!customerId) return 'Belirtilmemiş müşteri';
    try {
      const cust = getCustomerById(String(customerId));
      if (cust && (cust as any).customerName) {
        return `${(cust as any).customerName} (${customerId})`;
      }
    } catch (e) {}
    return String(customerId);
  };

  switch (toolName) {
    case 'addManualInvoice': {
      const a = args as AddManualInvoiceArgs;
      return `Yeni satış faturası eklenecek: ${resolveCustomerLabel(a.customerId)} — ${formatCurrency(a.amount || 0)}${a.invoiceDate ? `, tarih ${a.invoiceDate}` : ''}.`;
    }
    case 'addManualCollection': {
      const a = args as AddManualCollectionArgs;
      return `Yeni tahsilat eklenecek: ${resolveCustomerLabel(a.customerId)} — ${formatCurrency(a.amount || 0)}${a.method ? `, yöntem ${a.method}` : ''}.`;
    }
    case 'addVirmanTransfer': {
      const a = args as AddVirmanTransferArgs;
      return `Virman/aktarım yapılacak: ${resolveCustomerLabel(a.sourceCustomerId)} → ${resolveCustomerLabel(a.targetCustomerId)} — ${formatCurrency(a.amount || 0)}.`;
    }
    case 'deleteTransaction': {
      const a = args as DeleteTransactionArgs;
      return `Tekil işlem SİLİNECEK: ID ${a.id}${a.type ? ` (${a.type})` : ''}. Bu işlem geri alınamaz.`;
    }
    case 'bulkDeleteTransactions': {
      const a = args as BulkDeleteTransactionsArgs;
      return `TOPLU SİLME yapılacak: tür=${a.type || 'TÜMÜ'}${a.customerId ? `, müşteri=${resolveCustomerLabel(a.customerId)}` : ''}${a.year ? `, yıl=${a.year}` : ''}. Bu işlem geri alınamaz ve birden fazla kaydı etkiler.`;
    }
    case 'addManualCheque': {
      const a = args as AddManualChequeArgs;
      return `Yeni çek/senet eklenecek: ${resolveCustomerLabel(a.customerId)} — ${formatCurrency(a.amount || 0)}${a.dueDate ? `, vade ${a.dueDate}` : ''}.`;
    }
    case 'updateManualCheque': {
      const a = args as UpdateManualChequeArgs;
      return `Çek/senet güncellenecek: ID ${a.id}${a.status ? ` → durum "${a.status}"` : ''}.`;
    }
    case 'deleteManualCheque': {
      const a = args as DeleteManualChequeArgs;
      return `Çek/senet SİLİNECEK: ID ${a.id}. Bu işlem geri alınamaz.`;
    }
    case 'reconcileChequesWithExcel': {
      const a = args as ReconcileChequesWithExcelArgs;
      return `Excel ile çek mutabakatı yapılacak: dosya "${a.fileName || 'bilinmiyor'}"${a.action ? `, aksiyon ${a.action}` : ''}. Veritabanı kayıtları güncellenebilir.`;
    }
    case 'mapAndImportExcel': {
      const a = args as MapAndImportExcelArgs;
      return `Excel aktarımı yapılacak: dosya "${a.fileName || 'bilinmiyor'}" → hedef tür "${a.targetType || 'bilinmiyor'}". Çok sayıda yeni kayıt oluşabilir.`;
    }
    case 'advancedMapAndImportExcel': {
      const a = args as AdvancedMapAndImportExcelArgs;
      return `Gelişmiş Excel aktarımı yapılacak: dosya "${a.fileName || 'bilinmiyor'}". Çok sayıda yeni kayıt oluşabilir.`;
    }
    case 'importCustomerMaster':
    case 'processCustomerMasterImport': {
      const a = args as ImportCustomerMasterArgs;
      return `Müşteri master dosyası aktarılacak: "${a.fileName || 'bilinmiyor'}". Müşteri kartları toplu olarak eklenecek/güncellenecek.`;
    }
    case 'purgeTestImportRecords':
      return `Test/geçici aktarım kayıtları TEMİZLENECEK. Bu işlem geri alınamaz.`;
    case 'resetAndClearArchive':
    case 'clearAllDataArchive':
      return `TÜM ARŞİV VERİSİ SIFIRLANACAK. Bu işlem geri alınamaz ve tüm kayıtları etkiler.`;
    case 'draftManualTransaction':
      return `Finansal işlem taslağı oluşturulacak. Tür: ${args.transactionType || 'Bilinmiyor'}, Tutar: ${args.amount || 0}, Müşteri: ${resolveCustomerLabel(args.customerId)}.`;
    case 'previewManualTransaction':
      return `Taslak ID ${args.draftId || 'Bilinmiyor'} için önizleme (Before/After) ve risk analizi yapılacak.`;
    case 'commitManualTransaction':
      return `Önizlemesi onaylanmış işlem (Preview ID: ${args.previewId || 'Bilinmiyor'}) kalıcı olarak veritabanına YAZILACAK. Bu işlem geri alınamaz!`;
    case 'listManualSourceConflicts':
      return `Manuel kayıtlar ile ana sistem arasındaki kaynak çatışmaları listelenecek.`;
    default:
      return `"${toolName}" aracı veritabanında değişiklik yapacak. Parametreler: ${JSON.stringify(args)}.`;
  }
}

function getMutationToolNames(query: string): string[] {
  const safeTools = ['draftManualTransaction', 'previewManualTransaction', 'commitManualTransaction', 'listManualSourceConflicts'];
  if (/(virman|transfer)/i.test(query)) return ['addVirmanTransfer', ...safeTools];
  if (/çek/i.test(query) && /mutabakat/i.test(query)) return ['reconcileChequesWithExcel', ...safeTools];
  if (/çek/i.test(query) && /\bsil\b/i.test(query)) return ['deleteManualCheque', ...safeTools];
  if (/çek/i.test(query) && /(güncelle|düzelt)/i.test(query)) return ['updateManualCheque', ...safeTools];
  if (/çek/i.test(query) && /(ekle|gir|kaydet)/i.test(query)) return ['addManualCheque', ...safeTools];
  if (/fatura/i.test(query) && /(ekle|kes|gir|oluştur)/i.test(query)) return ['addManualInvoice', ...safeTools];
  if (/tahsilat/i.test(query) && /(ekle|al|gir|kaydet)/i.test(query)) return ['addManualCollection', ...safeTools];
  if (/toplu/i.test(query) && /\bsil\b/i.test(query)) return ['bulkDeleteTransactions', ...safeTools];
  if (/(purge|test.*temizle|temizle.*test)/i.test(query)) return ['purgeTestImportRecords', ...safeTools];
  if (/(sıfırla|arşiv.*sıfırla)/i.test(query)) return ['resetAndClearArchive', 'clearAllDataArchive', ...safeTools];
  if (/\bsil\b/i.test(query)) return ['deleteTransaction', ...safeTools];
  if (/(override|catisma coz|çatışma)/i.test(query)) return ['listManualSourceConflicts', 'previewManualTransaction', 'commitManualTransaction'];
  
  return ['addManualInvoice', 'addManualCollection', 'deleteTransaction', ...safeTools];
}

export function getRelevantToolsForQuery(userMessage = '', attachments: any[] = []) {
  const query = (userMessage || '').toLowerCase();
  const hasAttachments = attachments && attachments.length > 0;
  const intent = getQueryIntent(userMessage, attachments);

  let selectedToolNames: string[];

  if (intent === 'MUTATION') {
    selectedToolNames = getMutationToolNames(query);
  } else if (intent === 'EXCEL_ANALYSIS' || hasAttachments) {
    selectedToolNames = ['readUploadedExcelData', 'mapAndImportExcel', 'runExcelVerificationTest'];
  } else if (intent === 'GLOBAL_RECORD') {
    selectedToolNames = ['getGlobalHighestTransactions', 'queryTransactions'];
  } else if (intent === 'REP_PERFORMANCE') {
    selectedToolNames = /ssm|bölge/i.test(query)
      ? ['getSsmFinancialPerformance', 'getSalesFkns']
      : /karne|skor|hedef/i.test(query)
        ? ['getRepresentativeFinancialPerformance', 'getSalesRepSummary']
        : ['getSalesRepSummary', 'getMonthlyComparisonReport', 'getSalesFkns'];
  } else if (intent === 'SELLOUT') {
    selectedToolNames = /karsilastir|kiyasla|onceki ay|gecen yil|fark/i.test(query)
      ? ['getSelloutHistoricalComparison', 'getSelloutComparisonContributions', 'createSelloutReportPack']
      : /rapor|aylik/i.test(query)
        ? ['getSelloutMonthlyReport', 'createSelloutReportPack']
        : /penetrasyon/i.test(query)
          ? ['getProductPenetration', 'calculateSelloutProbability', 'getSalesFkns']
          : ['calculateSelloutProbability', 'getProductPenetration', 'getSalesFkns'];
  } else if (intent === 'SHIPMENT') {
    selectedToolNames = ['getShipmentTrackingReport', 'queryTransactions', 'getCustomerDetails'];
  } else if (intent === 'CUSTOMER') {
    selectedToolNames = /sağlık skoru|risk puanı/i.test(query) ? ['getCustomerFinancialHealth', 'explainFinancialHealthComponent', 'getCustomerDetails'] :
                        /iç limit|kredi önerisi/i.test(query) ? ['getInternalLimitRecommendation', 'explainInternalLimitChange', 'getCustomerDetails'] :
                        /ekstre/i.test(query)
      ? ['getCustomerStatement', 'searchCustomers']
      : ['searchCustomers', 'getCustomerDetails', 'queryTransactions'];
  } else if (intent === 'COLLECTION') {
    selectedToolNames = /cei/i.test(query)
      ? ['getCollectionEffectivenessIndex', 'getCollectionBreakdown', 'getPaymentMethodsBreakdown']
      : /ödeme\s+yöntem|dağılım/i.test(query)
        ? ['getPaymentMethodsBreakdown']
        : ['getCollectionBreakdown', 'getCollectionEffectivenessIndex', 'getPaymentMethodsBreakdown'];
  } else if (intent === 'RISK') {
    selectedToolNames = /çek|senet/i.test(query)
      ? ['getOverdueCustomersList', 'getCustomerCheques', 'getFinancialHealthReport']
      : /yaşlandırma|vadesi geçmiş/i.test(query)
        ? ['getAgingBreakdown', 'getOverdueCustomersList', 'getFinancialHealthReport']
        : ['getFinancialHealthReport', 'getOverdueCustomersList', 'getAgingBreakdown'];
  } else if (intent === 'COMPANY_OVERVIEW') {
    selectedToolNames = /durum|bugün/i.test(query)
      ? ['getCurrentStatus', 'getGlobalFinancialSummary', 'getMonthlyRiskAndRevenueReport']
      : ['getGlobalFinancialSummary', 'getCurrentStatus', 'getMonthlyRiskAndRevenueReport'];
  } else if (intent === 'FINANCIAL_REPORTING') {
    selectedToolNames = /dso|tahsilat s.resi/i.test(query) ? ['getAccountingDso', 'explainFinancialMetric', 'getFinancialReport'] :
                        /cei|kapanma/i.test(query) ? ['getAgedReceivableCei', 'explainFinancialMetric', 'getFinancialReport'] :
                        /h.z|speed/i.test(query) ? ['getPaymentSpeed', 'explainFinancialMetric', 'getFinancialReport'] :
                        /mutabakat|fark/i.test(query) ? ['getFinancialReconciliation', 'explainFinancialMetric', 'getFinancialReport'] :
                        /cari|risk|bakiye|finansal durum/i.test(query) ? ['getFinancialPosition', 'explainFinancialMetric', 'getFinancialReport'] :
                        /hhi|yoğunlaşma|konsantrasyon/i.test(query) ? ['getFinancialConcentration', 'getFinancialReport'] :
                        /migration|geçiş matrisi/i.test(query) ? ['getAgingMigrationMatrix', 'getAgingMigration', 'getFinancialReport'] :
                        /vintage|kohort/i.test(query) ? ['getInvoiceVintageAnalysis', 'getInvoiceVintage', 'getFinancialReport'] :
                        /survival|hayatta kalma/i.test(query) ? ['getPaymentSurvival', 'getFinancialReport'] :
                        /akış|yüklü alacak/i.test(query) ? ['getAgedBurdenFlow', 'getFinancialReport'] :
                        /peer|benchmark|kıyas/i.test(query) ? ['getPeerBenchmark', 'getFinancialReport'] :
                        /davranış|segment/i.test(query) ? ['getFinancialBehaviorSegment', 'getBehaviorSegment', 'getFinancialReport'] :
                        /yaşlandırma/i.test(query) ? ['getAgingMigration', 'getFinancialReport'] :
                        /öncelik/i.test(query) ? ['getCollectionPriority', 'getFinancialReport'] :
                        /restatement|açıklama/i.test(query) ? ['getRestatementImpact', 'getFinancialReport'] :
                        /anomali|sinyal/i.test(query) ? ['getDeteriorationSignals', 'getRobustAnomalies', 'getBehaviorSegment', 'getFinancialReport'] :
                        ['getFinancialReport', 'getParetoConcentrationAnalysis', 'explainFinancialMetric'];
  } else if (intent === 'FOCUS_ANALYSIS') {
    selectedToolNames = ['getAiFocusAnalysis', 'getFinancialHealthReport', 'getCustomerDetails'];
  } else if (intent === 'FORECASTING') {
    selectedToolNames = ['getCashForecast', 'getFinancialReport'];
  } else if (intent === 'SCENARIO') {
    selectedToolNames = ['runFinancialScenario', 'getFinancialReport'];
  } else if (intent === 'REPORT_ORCHESTRATION') {
    selectedToolNames = ['generateReportArtifact'];
  } else if (intent === 'WAREHOUSE_INVENTORY') {
    selectedToolNames = ['checkWarehouseStock'];
  } else if (intent === 'COMMERCIAL_INVENTORY') {
    selectedToolNames = ['checkCustomerCommercialStock', 'getCustomerDetails'];
  } else if (intent === 'DISPATCH_OPERATION') {
    selectedToolNames = ['getTodaysDispatchOrders', 'getCustomerDetails'];
  } else if (intent === 'INVOICE_CONTROL') {
    selectedToolNames = ['getDeliveredInvoiceControls', 'explainInvoiceControlAlert', 'getCustomerDetails'];
  } else {
    selectedToolNames = ['getGlobalFinancialSummary', 'getCurrentStatus'];
  }

  const selected = new Set([...selectedToolNames.slice(0, 2), DISCOVER_MORE_TOOLS]);
  return aiToolDeclarations.filter(t => selected.has(t.name));
}

export function getQueryIntent(userMessage = '', attachments: any[] = []): AiQueryIntent {
  return classifyAiQueryIntent(userMessage, Boolean(attachments?.length));
}

const CUSTOMER_SCOPED_ANALYSIS_TOOLS = new Set([
  'searchCustomers',
  'getCustomerDetails',
  'getCustomerStatement',
  'getCustomerCheques',
  'getCustomerPaymentTrend'
]);
const REP_SCOPED_ANALYSIS_TOOLS = new Set([
  'getSalesRepSummary',
  'getMonthlyComparisonReport'
]);
const NON_SCOPED_ANALYSIS_TOOLS = new Set([
  ...MUTATING_TOOLS,
  'readUploadedExcelData',
  'runExcelVerificationTest'
]);

function inferAnalysisScope(toolName: string): AiAnalysisResult['scope'] {
  if (NON_SCOPED_ANALYSIS_TOOLS.has(toolName)) return undefined;
  if (CUSTOMER_SCOPED_ANALYSIS_TOOLS.has(toolName)) return 'CUSTOMER';
  if (REP_SCOPED_ANALYSIS_TOOLS.has(toolName)) return 'REP';
  return 'COMPANY';
}

function analysisMetric(label: string, value: string, rawValue?: number): AiAnalysisResult['metrics'][number] {
  return rawValue === undefined ? { label, value } : { label, value, rawValue };
}

export function buildAiAnalysisResult(toolName: string, _args: any = {}, result: any = {}): AiAnalysisResult {
  const scope = inferAnalysisScope(toolName);
  const metrics: AiAnalysisResult['metrics'] = [];
  const r = result || {};

  switch (toolName) {
    case 'searchCustomers':
    case 'getShipmentTrackingReport': {
      const count = typeof r.count === 'number'
        ? r.count
        : (typeof r.customerCount === 'number' ? r.customerCount : (Array.isArray(r.customers) ? r.customers.length : undefined));
      if (typeof count === 'number') metrics.push(analysisMetric('Müşteri sayısı', String(count), count));
      break;
    }
    case 'getSalesRepSummary': {
      if (Array.isArray(r.salesReps)) metrics.push(analysisMetric('Temsilci sayısı', String(r.salesReps.length), r.salesReps.length));
      break;
    }
    case 'getGlobalFinancialSummary': {
      if (r.totalSales) metrics.push(analysisMetric('Toplam satış', String(r.totalSales)));
      if (r.totalCollections) metrics.push(analysisMetric('Toplam tahsilat', String(r.totalCollections)));
      if (r.netReceivables) metrics.push(analysisMetric('Net alacak bakiyesi', String(r.netReceivables)));
      break;
    }
    case 'getCurrentStatus': {
      if (typeof r.openInvoicesCount === 'number') metrics.push(analysisMetric('Açık fatura sayısı', String(r.openInvoicesCount), r.openInvoicesCount));
      if (r.todayCollections) metrics.push(analysisMetric('Bugünkü tahsilat', String(r.todayCollections)));
      break;
    }
    case 'getAgingBreakdown': {
      if (Array.isArray(r.agingBuckets)) metrics.push(analysisMetric('Yaşlandırma dilimi sayısı', String(r.agingBuckets.length), r.agingBuckets.length));
      break;
    }
    case 'getPaymentMethodsBreakdown': {
      if (Array.isArray(r.methods)) metrics.push(analysisMetric('Ödeme yöntemi sayısı', String(r.methods.length), r.methods.length));
      break;
    }
    case 'getCollectionEffectivenessIndex': {
      if (r.ceiPercentage) metrics.push(analysisMetric('CEI', String(r.ceiPercentage)));
      break;
    }
    case 'getFinancialHealthReport': {
      if (typeof r.healthScore === 'number') metrics.push(analysisMetric('Health score', String(r.healthScore), r.healthScore));
      break;
    }
    case 'getGlobalHighestTransactions': {
      if (typeof r.count === 'number') metrics.push(analysisMetric('Adet', String(r.count), r.count));
      break;
    }
    case 'getFinancialConcentration': {
      const d = r.data || r;
      if (d.hhiScore !== undefined) metrics.push(analysisMetric('HHI Skoru', String(d.hhiScore)));
      break;
    }
    case 'getAgingMigrationMatrix': {
      const d = r.data || r;
      if (d.period) metrics.push(analysisMetric('Geçiş Dönemi', String(d.period)));
      break;
    }
    case 'getInvoiceVintageAnalysis': {
      const d = r.data || r;
      if (d.cohortMonth) metrics.push(analysisMetric('Vintage Kohortu', String(d.cohortMonth)));
      break;
    }
    case 'getPaymentSurvival': {
      const d = r.data || r;
      if (d.medianPaymentDays !== undefined) metrics.push(analysisMetric('Medyan Kapanış', `${d.medianPaymentDays} gün`));
      break;
    }
    case 'getAgedBurdenFlow': {
      const d = r.data || r;
      if (d.agedPoolTotal !== undefined) metrics.push(analysisMetric('29+ Havuz Toplamı', String(d.agedPoolTotal)));
      break;
    }
    case 'getPeerBenchmark': {
      const d = r.data || r;
      if (d.percentileRank !== undefined) metrics.push(analysisMetric('Akran Sıralaması (Percentile)', `%${d.percentileRank}`));
      break;
    }
    case 'getFinancialBehaviorSegment': {
      const d = r.data || r;
      if (d.behaviorClass) metrics.push(analysisMetric('Davranış Segmenti', String(d.behaviorClass)));
      break;
    }
    default:
      break;
  }

  if (metrics.length === 0) {
    metrics.push(analysisMetric('Sonuç durumu', 'Veri alındı'));
  }

  return { scope, metrics };
}

export function discoverMoreTools(topic = '') {
  return {
    status: 'TOOLSET_EXPANDED',
    topic: String(topic).slice(0, 200),
    availableTools: aiToolDeclarations
      .filter((tool) => tool.name !== DISCOVER_MORE_TOOLS)
      .map(({ name, description }) => ({ name, description }))
  };
}

export async function executeAiTool(toolName: string, args: any = {}): Promise<any> {
  await waitForInit();
  try {
    if (MUTATING_TOOLS.includes(toolName) && !isAdminAuthenticated()) {
      return {
        error: 'ADMIN_REQUIRED',
        status: 'DENIED',
        message: '🔒 Bu işlem veritabanında değişiklik (Yükleme/Silme/Ekleme) gerektirdiği için yalnızca Admin yetkisiyle yapılabilir. Lütfen sohbet paneli başlığındaki kilit simgesinden Admin Girişi yapınız.'
      };
    }
    
    if (toolName === DISCOVER_MORE_TOOLS) {
      return discoverMoreTools(args?.topic);
    }
    
    const registeredReadHandler = getReadToolHandler(toolName);
    if (registeredReadHandler) {
      return await registeredReadHandler(args as AiToolArgs);
    }

    const agentHandler = getAgentToolHandler(toolName);
    if (agentHandler) {
      return await agentHandler(args);
    }

    const excelHandler = getExcelImportToolHandler(toolName);
    if (excelHandler) {
      return await excelHandler(args);
    }

    const mutationHandler = getMutationToolHandler(toolName);
    if (mutationHandler) {
      return await mutationHandler(args);
    }

    if (toolName === 'getFinancialReport') return await handleGetFinancialReport(args);
    if (toolName === 'getDeteriorationSignals') return await handleGetDeteriorationSignals(args);
    if (toolName === 'getRobustAnomalies') return await handleGetRobustAnomalies(args);
    if (toolName === 'getBehaviorSegment') return await handleGetBehaviorSegment(args);

    // AI-16 Tools
    if (toolName === 'getFinancialPosition') return await handleGetFinancialPosition(args);
    if (toolName === 'getFinancialReconciliation') return await handleGetFinancialReconciliation(args);
    if (toolName === 'getAccountingDso') return await handleGetAccountingDso();
    if (toolName === 'getAgedReceivableCei') return await handleGetAgedReceivableCei();
    if (toolName === 'getPaymentSpeed') return await handleGetPaymentSpeed(args as any);
    if (toolName === 'explainFinancialMetric') return await handleExplainFinancialMetric(args as any);

    // AI-17 Tools
    if (toolName === 'getCustomerFinancialHealth') return await handleGetCustomerFinancialHealth(args as any);
    if (toolName === 'explainFinancialHealthComponent') return await handleExplainFinancialHealthComponent(args as any);
    if (toolName === 'getInternalLimitRecommendation') return await handleGetInternalLimitRecommendation(args as any);
    if (toolName === 'explainInternalLimitChange') return await handleExplainInternalLimitChange(args as any);
    if (toolName === 'getRepresentativeFinancialPerformance') return await handleGetRepresentativeFinancialPerformance(args as any);
    if (toolName === 'getSsmFinancialPerformance') return await handleGetSsmFinancialPerformance(args as any);

    // AI-19 Tools
    if (toolName === 'getFinancialConcentration') return await handleGetFinancialConcentration();
    if (toolName === 'getAgingMigrationMatrix') return await handleGetAgingMigrationMatrix(args as any);
    if (toolName === 'getInvoiceVintageAnalysis') return await handleGetInvoiceVintageAnalysis(args as any);
    if (toolName === 'getPaymentSurvival') return await handleGetPaymentSurvival(args as any);
    if (toolName === 'getAgedBurdenFlow') return await handleGetAgedBurdenFlow();
    if (toolName === 'getFinancialBehaviorSegment') return await handleGetFinancialBehaviorSegment(args as any);
    if (toolName === 'getPeerBenchmark') return await handleGetPeerBenchmark(args as any);

    if (toolName === 'getAgingMigration') return await handleGetAgingMigration(args);
    if (toolName === 'getInvoiceVintage') return await handleGetInvoiceVintage(args);
    if (toolName === 'getCashForecast') return await handleGetCashForecast(args);
    if (toolName === 'runFinancialScenario') return await handleRunFinancialScenario(args);
    if (toolName === 'getSelloutHistoricalComparison') return await handleGetSelloutHistoricalComparison(args);
    if (toolName === 'getRestatementImpact') return await handleGetRestatementImpact(args);
    if (toolName === 'getCollectionPriority') return await handleGetCollectionPriority(args);
    if (toolName === 'generateReportArtifact') return await handleGenerateReportArtifact(args as any);
    
    // AI-18
    if (toolName === 'getAiFocusAnalysis') return await handleGetAiFocusAnalysis(args as any);

    if (toolName === 'checkWarehouseStock') return await handleCheckWarehouseStock(args);
    if (toolName === 'checkCustomerCommercialStock') return await handleCheckCustomerCommercialStock(args);
    
    if (toolName === 'getTodaysDispatchOrders') return await handleGetTodaysDispatchOrders();
    if (toolName === 'getDeliveredInvoiceControls') return await handleGetDeliveredInvoiceControls(args);
    if (toolName === 'explainInvoiceControlAlert') return await handleExplainInvoiceControlAlert(args);

    if (toolName === 'getSelloutHistoricalComparison') return await handleGetSelloutHistoricalComparison(args);
    if (toolName === 'getSelloutMonthlyReport') return await handleGetSelloutMonthlyReport(args);
    if (toolName === 'getSelloutComparisonContributions') return await handleGetSelloutComparisonContributions(args);
    if (toolName === 'createSelloutReportPack') return await handleCreateSelloutReportPack(args);
    if (toolName === 'calculateSelloutProbability') return await handleCalculateSelloutProbability(args);

    if (toolName === 'draftManualTransaction') return await handleDraftManualTransaction(args);
    if (toolName === 'previewManualTransaction') return await handlePreviewManualTransaction(args);
    if (toolName === 'commitManualTransaction') return await handleCommitManualTransaction(args);
    if (toolName === 'listManualSourceConflicts') return await handleListManualSourceConflicts();

    // Yedek (Eğer registry'lerde yoksa, aiToolDeclarations üstünden asıl execute metodu çağrılabilir mi diye bakar)
    const toolDef = aiToolDeclarations.find(t => t.name === toolName);
    if (toolDef && (toolDef as any).execute) {
      return await (toolDef as any).execute(args);
    }
    return { error: `Bilinmeyen fonksiyon: ${toolName}` };
  } catch (err: any) {
    return { error: `Fonksiyon çalıştırma hatası (${toolName}): ${err.message}` };
  }
}
